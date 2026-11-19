// The mastery engine. Rules drawn from the Alpha School model:
//  • a grade is passed only at 100% on its challenge ("100 for 100")
//  • a missed challenge question opens that skill for hole-filling
//  • a skill is mastered at ≥90% over its last 8–10 grade-level questions, then re-checked
//    after 1 day, 7 days and 21 days (spaced repetition); a failed check reopens it
//  • if a skill stays below 50%, its prerequisites are re-checked (trace the gap downward)
//  • facts are trained to speed (≤3 s) because fluency frees working memory
import { randomUUID } from "crypto";
import { SKILLS, SKILL, skillsInGrade, GRADES, Problem } from "./skills";
import { check } from "./check";
import { levelOf } from "./level";
import { all, one, run, getSettings } from "./db";

const DAY = 86_400_000;
const FACT_FLUENT_MS = 3000;
const FACT_INTERVALS = [0, DAY, 2 * DAY, 4 * DAY, 8 * DAY, 16 * DAY];
export const HOURS_PER_GRADE = 22; // Alpha's figure for Grades 6 and 7 maths; used for the estimate only

type Mode = "fact" | "learn" | "review" | "check" | "challenge";
export type Segment = "facts" | "review" | "main";

interface SkillRow { id: string; status: "unknown" | "learning" | "mastered" | "check"; level: number; stage: number; next_check: number | null; mastered_at: number | null; since: number | null; traced: number | null }
interface Pending { mode: Mode; skillId?: string; level: number; problem: Problem; challengeId?: number; fact?: string; sessionId: number }

export interface ClientItem {
  id: string; mode: Mode; skillTitle?: string; grade?: number;
  prompt: string; speak: string; kind: Problem["kind"]; choices?: string[]; unit?: string; visual?: Problem["visual"];
  progress?: { idx: number; total: number };
}
export type NextResult = { item: ClientItem } | { intro: { grade: number; total: number; reward: number; currency: string; retake: boolean } } | { empty: true } | { finished: true };

// ── skill state helpers
async function skillState(id: string): Promise<SkillRow> {
  return (await one<SkillRow>("SELECT * FROM skill_state WHERE id = ?", [id])) ?? { id, status: "unknown", level: 1, stage: 0, next_check: null, mastered_at: null, since: null, traced: null };
}
async function setSkill(id: string, p: Partial<SkillRow>) {
  const cur = await skillState(id);
  const n = { ...cur, ...p };
  await run("INSERT INTO skill_state(id,status,level,stage,next_check,mastered_at,since,traced) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, level=excluded.level, stage=excluded.stage, next_check=excluded.next_check, mastered_at=excluded.mastered_at, since=excluded.since, traced=excluded.traced", [id, n.status, n.level, n.stage, n.next_check, n.mastered_at, n.since, n.traced]);
}
const markMastered = (id: string, now: number) => setSkill(id, { status: "mastered", stage: 1, next_check: now + DAY, mastered_at: now, since: now });
const markLearning = (id: string, now: number) => setSkill(id, { status: "learning", level: 1, stage: 0, next_check: null, since: now });

async function allStates(): Promise<Record<string, SkillRow>> {
  const rows = await all<SkillRow>("SELECT * FROM skill_state");
  const m: Record<string, SkillRow> = {};
  for (const s of SKILLS) m[s.id] = { id: s.id, status: "unknown", level: 1, stage: 0, next_check: null, mastered_at: null, since: null, traced: null };
  for (const r of rows) m[r.id] = r;
  return m;
}

// ── facts (Leitner boxes, 2–12 tables)
async function ensureFacts() {
  const n = await one<{ c: number }>("SELECT COUNT(*) c FROM fact_state");
  if (n && Number(n.c) > 0) return;
  for (let a = 2; a <= 12; a++) for (let b = a; b <= 12; b++) await run("INSERT OR IGNORE INTO fact_state(fact) VALUES(?)", [`${a}x${b}`]);
}
function factProblem(fact: string): Problem {
  const [a, b] = fact.split("x").map(Number);
  const [x, y] = Math.random() < 0.5 ? [a, b] : [b, a];
  if (Math.random() < 0.65) return { prompt: `${x} × ${y}`, speak: `${x} times ${y}`, answer: String(a * b), kind: "number", steps: [`${x} × ${y} = ${a * b}`] };
  return { prompt: `${a * b} ÷ ${x}`, speak: `${a * b} divided by ${x}`, answer: String(y), kind: "number", steps: [`${x} × ${y} = ${a * b}, so ${a * b} ÷ ${x} = ${y}`] };
}

// ── items
async function makePending(p: Pending): Promise<ClientItem> {
  const id = randomUUID();
  await run("DELETE FROM pending WHERE created < ?", [Date.now() - DAY]);
  await run("INSERT INTO pending(id, created, payload) VALUES(?,?,?)", [id, Date.now(), JSON.stringify(p)]);
  const sk = p.skillId ? SKILL[p.skillId] : undefined;
  return { id, mode: p.mode, skillTitle: sk?.title, grade: sk?.grade, prompt: p.problem.prompt, speak: p.problem.speak ?? p.problem.prompt, kind: p.problem.kind, choices: p.problem.choices, unit: p.problem.unit, visual: p.problem.visual };
}

async function openChallenge() {
  return one<{ id: number; grade: number; questions: string; idx: number; total: number }>("SELECT * FROM challenges WHERE finished IS NULL ORDER BY id DESC LIMIT 1");
}
async function passedGrades(): Promise<Set<number>> {
  return new Set((await all<{ grade: number }>("SELECT DISTINCT grade FROM challenges WHERE passed = 1")).map((r) => Number(r.grade)));
}

export async function nextItem(sessionId: number, segment: Segment): Promise<NextResult> {
  const now = Date.now();
  if (segment === "facts") {
    await ensureFacts();
    const cands = await all<{ fact: string }>("SELECT fact FROM fact_state WHERE due <= ? ORDER BY box ASC, seen ASC, RANDOM() LIMIT 8", [now]);
    const pool = cands.length ? cands : await all<{ fact: string }>("SELECT fact FROM fact_state ORDER BY last_ms DESC LIMIT 8");
    const fact = pool[Math.floor(Math.random() * pool.length)].fact;
    return { item: await makePending({ mode: "fact", fact, level: 1, problem: factProblem(fact), sessionId }) };
  }

  const states = await allStates();
  if (segment === "review") {
    const due = Object.values(states).filter((s) => s.status === "mastered" && s.next_check && s.next_check <= now).sort((a, b) => a.next_check! - b.next_check!);
    if (!due.length) return { empty: true };
    const s = SKILL[due[0].id];
    return { item: await makePending({ mode: "review", skillId: s.id, level: 2, problem: s.gen(Math.random, 2), sessionId }) };
  }

  // main: open challenge → prerequisite checks → hole-filling → next challenge
  const ch = await openChallenge();
  if (ch) {
    const qs = JSON.parse(ch.questions) as { skillId: string; level: 2 | 3; problem: Problem }[];
    const q = qs[ch.idx];
    const item = await makePending({ mode: "challenge", skillId: q.skillId, level: q.level, problem: q.problem, challengeId: ch.id, sessionId });
    return { item: { ...item, skillTitle: `Level ${levelOf(Number(ch.grade))} Challenge`, progress: { idx: Number(ch.idx), total: Number(ch.total) } } };
  }
  const checks = Object.values(states).filter((s) => s.status === "check").map((s) => SKILL[s.id]).sort((a, b) => a.grade - b.grade);
  if (checks.length) return { item: await makePending({ mode: "check", skillId: checks[0].id, level: 2, problem: checks[0].gen(Math.random, 2), sessionId }) };

  const learning = Object.values(states).filter((s) => s.status === "learning");
  if (learning.length) {
    // frontier: skills whose own prerequisites aren't open; lowest grade first, interleave within it
    const frontier = learning.filter((s) => SKILL[s.id].prereqs.every((p) => states[p].status !== "learning" && states[p].status !== "check"));
    const pool = frontier.length ? frontier : learning;
    const minG = Math.min(...pool.map((s) => SKILL[s.id].grade));
    const g = pool.filter((s) => SKILL[s.id].grade === minG);
    const s = g[Math.floor(Math.random() * g.length)];
    const lvl = Math.max(1, Math.min(3, Number(s.level))) as 1 | 2 | 3;
    return { item: await makePending({ mode: "learn", skillId: s.id, level: lvl, problem: SKILL[s.id].gen(Math.random, lvl), sessionId }) };
  }

  const passed = await passedGrades();
  const grade = GRADES.find((g) => !passed.has(g));
  if (!grade) {
    // Everything passed: keep it fresh with mixed review across all skills
    const s = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    return { item: await makePending({ mode: "review", skillId: s.id, level: 3, problem: s.gen(Math.random, 3), sessionId }) };
  }
  const settings = await getSettings();
  const tried = await one("SELECT id FROM challenges WHERE grade = ? LIMIT 1", [grade]);
  return { intro: { grade, total: skillsInGrade(grade).length * 2, reward: settings.rewards[String(grade)] ?? 0, currency: settings.currency, retake: !!tried } };
}

export async function startChallenge(grade: number) {
  const existing = await openChallenge();
  if (existing) return existing.id;
  const qs = skillsInGrade(grade).flatMap((s) => ([2, 3] as const).map((level) => ({ skillId: s.id, level, problem: s.gen(Math.random, level) })));
  for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  const r = await run("INSERT INTO challenges(grade, started, questions, total) VALUES(?,?,?,?)", [grade, Date.now(), JSON.stringify(qs), qs.length]);
  return Number(r.lastInsertRowid);
}

export interface SubmitResult {
  correct: boolean; answer: string; feedback?: string; steps: string[]; attemptId: number;
  coach?: string; factMs?: number; fluent?: boolean;
  event?: { type: "mastered"; skill: string } | { type: "reopened"; skill: string } | { type: "traced"; skills: string[] } | { type: "challengeDone"; grade: number; correct: number; total: number; passed: boolean; reward: number; currency: string; holes: string[] };
}

export async function submit(itemId: string, response: string, ms: number): Promise<SubmitResult | null> {
  const row = await one<{ payload: string }>("SELECT payload FROM pending WHERE id = ?", [itemId]);
  if (!row) return null;
  await run("DELETE FROM pending WHERE id = ?", [itemId]);
  const p = JSON.parse(row.payload) as Pending;
  const now = Date.now();
  const res = check(p.problem, response);
  const flags: string[] = [];
  let coach: string | undefined;
  if (!res.correct && p.mode !== "fact" && ms < 2500 && !res.feedback) { flags.push("rushed"); coach = "That was very quick. Slow down and read it twice. Speed comes later."; }

  const ins = await run("INSERT INTO attempts(ts, session_id, skill_id, mode, level, prompt, answer, response, correct, ms, flags, payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    [now, p.sessionId, p.skillId ?? `fact:${p.fact}`, p.mode, p.level, p.problem.prompt, p.problem.answer, response, res.correct ? 1 : 0, ms, flags.join(","), JSON.stringify({ steps: p.problem.steps, visual: p.problem.visual })]);
  const out: SubmitResult = { correct: res.correct, answer: p.problem.answer, feedback: res.feedback, steps: p.problem.steps, attemptId: Number(ins.lastInsertRowid), coach };

  if (p.mode === "fact" && p.fact) {
    const f = await one<{ box: number }>("SELECT box FROM fact_state WHERE fact = ?", [p.fact]);
    let box = Number(f?.box ?? 0);
    const fluent = res.correct && ms <= FACT_FLUENT_MS;
    box = !res.correct ? 0 : fluent ? Math.min(5, box + 1) : box;
    await run("UPDATE fact_state SET box = ?, last_ms = ?, due = ?, seen = seen + 1 WHERE fact = ?", [box, ms, now + (res.correct ? FACT_INTERVALS[box] : 0), p.fact]);
    out.factMs = ms; out.fluent = fluent;
    return out;
  }

  const id = p.skillId!;
  const sk = SKILL[id];
  const st = await skillState(id);

  if (p.mode === "review") {
    if (res.correct) {
      const stage = Math.min(3, st.stage + 1);
      await setSkill(id, { stage, next_check: now + (stage === 2 ? 7 * DAY : stage === 3 ? 21 * DAY : 30 * DAY) });
    } else if (st.status === "mastered") {
      await markLearning(id, now);
      out.event = { type: "reopened", skill: sk.title };
    }
  }

  if (p.mode === "check") {
    if (!res.correct) await markLearning(id, now);
    else {
      const recent = await all<{ correct: number }>("SELECT correct FROM attempts WHERE skill_id = ? AND mode = 'check' AND ts >= ? ORDER BY ts DESC LIMIT 2", [id, st.since ?? 0]);
      if (recent.length >= 2 && recent.every((r) => Number(r.correct) === 1)) { await markMastered(id, now); out.event = { type: "mastered", skill: sk.title }; }
    }
  }

  if (p.mode === "learn") {
    const since = st.since ?? 0;
    const graded = await all<{ correct: number; ms: number }>("SELECT correct, ms FROM attempts WHERE skill_id = ? AND mode = 'learn' AND level >= 2 AND ts >= ? ORDER BY ts DESC LIMIT 10", [id, since]);
    const counts = graded.map((r) => Number(r.correct) === 1 && (!sk.fluencyMs || Number(r.ms) <= sk.fluencyMs));
    const hits = counts.filter(Boolean).length;
    if (graded.length >= 8 && hits >= Math.ceil(graded.length * 0.9) && counts[0]) {
      await markMastered(id, now);
      out.event = { type: "mastered", skill: sk.title };
    } else {
      // adapt difficulty to stay near 80–85% correct
      const atLevel = await all<{ correct: number }>("SELECT correct FROM attempts WHERE skill_id = ? AND mode = 'learn' AND level = ? AND ts >= ? ORDER BY ts DESC LIMIT 4", [id, st.level, since]);
      const c = atLevel.filter((r) => Number(r.correct) === 1).length;
      let level = st.level;
      if (atLevel.length === 4 && c === 4 && level < 3) level++;
      else if (atLevel.length === 4 && c <= 2 && level > 1) level--;
      // trace downward: persistent struggle means the hole is probably in a prerequisite
      const last8 = await all<{ correct: number }>("SELECT correct FROM attempts WHERE skill_id = ? AND mode = 'learn' AND ts >= ? ORDER BY ts DESC LIMIT 8", [id, since]);
      let traced = st.traced;
      if (last8.length === 8 && last8.filter((r) => Number(r.correct) === 1).length < 4 && (!traced || now - traced > 3 * DAY)) {
        const toCheck: string[] = [];
        for (const pre of sk.prereqs) { const ps = await skillState(pre); if (ps.status !== "learning" && ps.status !== "check") { await setSkill(pre, { status: "check", since: now }); toCheck.push(SKILL[pre].title); } }
        traced = now;
        if (toCheck.length) out.event = { type: "traced", skills: toCheck };
      }
      await setSkill(id, { level, traced });
    }
  }

  if (p.mode === "challenge" && p.challengeId) {
    const ch = (await one<{ id: number; grade: number; idx: number; total: number; correct: number }>("SELECT id, grade, idx, total, correct FROM challenges WHERE id = ?", [p.challengeId]))!;
    const idx = Number(ch.idx) + 1, correct = Number(ch.correct) + (res.correct ? 1 : 0), total = Number(ch.total);
    if (idx < total) await run("UPDATE challenges SET idx = ?, correct = ? WHERE id = ?", [idx, correct, ch.id]);
    else {
      const passed = correct === total;
      await run("UPDATE challenges SET idx = ?, correct = ?, finished = ?, passed = ? WHERE id = ?", [idx, correct, now, passed ? 1 : 0, ch.id]);
      const results = await all<{ skill_id: string; correct: number }>("SELECT skill_id, correct FROM attempts WHERE mode = 'challenge' AND ts >= (SELECT started FROM challenges WHERE id = ?) AND session_id IS NOT NULL", [ch.id]);
      const missed = new Set(results.filter((r) => Number(r.correct) === 0).map((r) => r.skill_id));
      const holes: string[] = [];
      for (const s of skillsInGrade(Number(ch.grade))) {
        const cur = await skillState(s.id);
        if (missed.has(s.id)) { await markLearning(s.id, now); holes.push(s.title); }
        else if (cur.status !== "mastered") await markMastered(s.id, now);
      }
      const settings = await getSettings();
      const reward = passed ? settings.rewards[String(ch.grade)] ?? 0 : 0;
      if (passed && reward > 0) await run("INSERT INTO rewards(grade, amount, earned) VALUES(?,?,?)", [ch.grade, reward, now]);
      out.event = { type: "challengeDone", grade: Number(ch.grade), correct, total, passed, reward, currency: settings.currency, holes };
    }
  }
  return out;
}

export async function recordExplainTime(attemptId: number, ms: number) {
  const flag = ms < 4000 ? ",skipped" : "";
  await run("UPDATE attempts SET explain_ms = ?, flags = COALESCE(flags,'') || ? WHERE id = ?", [ms, flag, attemptId]);
  return { skipped: !!flag };
}
export async function labelAttempt(attemptId: number, label: "careless" | "didnt_know") {
  await run("UPDATE attempts SET label = ? WHERE id = ?", [label, attemptId]);
}
export async function gameFilm(sessionId: number) {
  return all<{ id: number; prompt: string; answer: string; response: string; skill_id: string; mode: string }>(
    "SELECT id, prompt, answer, response, skill_id, mode FROM attempts WHERE session_id = ? AND correct = 0 AND mode != 'fact' AND label IS NULL ORDER BY ts LIMIT 6", [sessionId]);
}

// ── sessions
export async function startSession(minutes: number) {
  const r = await run("INSERT INTO sessions(started, minutes) VALUES(?,?)", [Date.now(), minutes]);
  return Number(r.lastInsertRowid);
}
export async function tickSession(id: number, activeMs: number, end = false) {
  await run(`UPDATE sessions SET active_ms = MAX(active_ms, ?)${end ? ", ended = ?" : ""} WHERE id = ?`, end ? [activeMs, Date.now(), id] : [activeMs, id]);
}

// ── overview (student home and parent dashboard)
export async function overview() {
  const states = await allStates();
  const passed = await passedGrades();
  const grades = GRADES.map((g) => {
    const sk = skillsInGrade(g);
    const mastered = sk.filter((s) => states[s.id].status === "mastered").length;
    return { grade: g, passed: passed.has(g), mastered, total: sk.length, skills: sk.map((s) => ({ id: s.id, title: s.title, strand: s.strand, status: states[s.id].status, stage: states[s.id].stage, level: states[s.id].level })) };
  });
  const hoursLeft = grades.reduce((h, g) => h + (g.passed && g.mastered === g.total ? 0 : HOURS_PER_GRADE * (1 - g.mastered / g.total)), 0);
  const sess = await all<{ started: number; active_ms: number }>("SELECT started, active_ms FROM sessions ORDER BY started DESC");
  const activeHours = sess.reduce((a, s) => a + Number(s.active_ms), 0) / 3_600_000;
  const days = [...new Set(sess.filter((s) => Number(s.active_ms) > 120_000).map((s) => new Date(Number(s.started)).toDateString()))];
  let streak = 0;
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { if (days.includes(d.toDateString())) streak++; else if (streak || d.toDateString() !== new Date().toDateString()) break; }
  const facts = await all<{ box: number }>("SELECT box FROM fact_state");
  const rewards = await all<{ id: number; grade: number; amount: number; earned: number; paid: number | null }>("SELECT * FROM rewards ORDER BY earned");
  const week = await one<{ n: number; c: number; w: number; careless: number; labelled: number }>(
    "SELECT COUNT(*) n, SUM(correct) c, SUM(CASE WHEN flags LIKE '%rushed%' OR flags LIKE '%skipped%' THEN 1 ELSE 0 END) w, SUM(CASE WHEN label='careless' THEN 1 ELSE 0 END) careless, SUM(CASE WHEN label IS NOT NULL THEN 1 ELSE 0 END) labelled FROM attempts WHERE ts > ? AND mode != 'fact'", [Date.now() - 7 * DAY]);
  const n = Number(week?.n ?? 0);
  const current = GRADES.find((g) => !passed.has(g)) ?? 8;
  return {
    grades, current, hoursLeft: Math.round(hoursLeft * 10) / 10, activeHours: Math.round(activeHours * 10) / 10, streak,
    facts: { fluent: facts.filter((f) => Number(f.box) >= 3).length, total: facts.length || 66 },
    rewards, week: { attempts: n, accuracy: n ? Number(week!.c) / n : null, focus: n ? 1 - Number(week!.w) / n : null, careless: Number(week?.careless ?? 0), labelled: Number(week?.labelled ?? 0) },
  };
}

export async function recentAttempts(limit = 300) {
  return all<{ ts: number; skill_id: string; mode: string; correct: number; ms: number; flags: string; label: string; prompt: string; response: string; answer: string }>(
    "SELECT ts, skill_id, mode, correct, ms, flags, label, prompt, response, answer FROM attempts ORDER BY ts DESC LIMIT ?", [limit]);
}
