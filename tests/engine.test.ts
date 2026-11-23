// Drives the real engine against a throwaway local database, to prove the learner settings are wired through.
import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "mastery-test-")), "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

let E: typeof import("../src/lib/engine");
let D: typeof import("../src/lib/db");
let sessionId: number;

beforeAll(async () => {
  D = await import("../src/lib/db");
  E = await import("../src/lib/engine");
  sessionId = await E.startSession(20);
});

async function answerFact(ms: number) {
  const next = await E.nextItem(sessionId, "facts");
  if (!("item" in next)) throw new Error("expected a fact");
  const row = await D.one<{ payload: string }>("SELECT payload FROM pending WHERE id = ?", [next.item.id]);
  const answer = JSON.parse(row!.payload).problem.answer as string;
  return (await E.submit(next.item.id, answer, ms))!;
}

describe("engine with learner settings", () => {
  it("defaults to 1.5 and clamps what is saved", async () => {
    expect((await D.getSettings()).timeMultiplier).toBe(1.5);
    expect((await D.getSettings()).calculator).toBe(true);
    await D.saveSettings({ timeMultiplier: 9 });
    expect((await D.getSettings()).timeMultiplier).toBe(2);
    await D.saveSettings({ timeMultiplier: 0 });
    expect((await D.getSettings()).timeMultiplier).toBe(1);
  });

  it("applies the multiplier to fact fluency", async () => {
    await D.saveSettings({ timeMultiplier: 1.5 });
    expect((await answerFact(4000)).fluent).toBe(true);
    await D.saveSettings({ timeMultiplier: 1 });
    expect((await answerFact(4000)).fluent).toBe(false);
    expect((await answerFact(2900)).fluent).toBe(true);
  });

  it("reports her own recent best time for a fact", async () => {
    let seen = false;
    for (let i = 0; i < 120 && !seen; i++) {
      const r = await answerFact(2000 + i); // each try a little slower than the last
      if (r.factBestMs === undefined) continue;
      seen = true;
      // worked out a second way: the fastest of her previous 5 correct tries on the same fact
      const me = (await D.one<{ skill_id: string }>("SELECT skill_id FROM attempts WHERE id = ?", [r.attemptId]))!;
      const prior = await D.all<{ ms: number }>("SELECT ms FROM attempts WHERE skill_id = ? AND correct = 1 AND id < ? ORDER BY id DESC LIMIT 5", [me.skill_id, r.attemptId]);
      expect(prior.length).toBeGreaterThan(0);
      expect(r.factBestMs).toBe(Math.min(...prior.map((x) => Number(x.ms))));
    }
    expect(seen).toBe(true);
  });

  it("applies the multiplier to a skill's speed target for mastery", async () => {
    const id = "g4.mulfacts"; // speed target 6 s
    async function practise(n: number, ms: number) {
      let last;
      for (let i = 0; i < n; i++) {
        const next = await E.nextItem(sessionId, "main", id);
        if ("example" in next) { await E.completeExample(id); i--; continue; }
        if (!("item" in next)) throw new Error("expected a practice question");
        const row = await D.one<{ payload: string }>("SELECT payload FROM pending WHERE id = ?", [next.item.id]);
        last = await E.submit(next.item.id, JSON.parse(row!.payload).problem.answer, ms);
      }
      return last!;
    }
    const open = (lvl: number) => D.run("INSERT INTO skill_state(id,status,level,stage,since) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status='learning', level=excluded.level, since=excluded.since, example_at=NULL", [id, "learning", lvl, 0, Date.now()]);

    await D.saveSettings({ timeMultiplier: 1 });
    await open(2);
    const strict = await practise(10, 8000); // right, but slower than 6 s
    expect(strict.event?.type).not.toBe("mastered");
    expect((await D.one<{ status: string }>("SELECT status FROM skill_state WHERE id = ?", [id]))!.status).toBe("learning");

    await D.saveSettings({ timeMultiplier: 1.5 }); // target becomes 9 s
    const relaxed = await practise(1, 8000);
    expect(relaxed.event).toEqual({ type: "mastered", skill: "Multiplication facts to 10 × 10" });
  });

  it("shows a worked example once per learning period, then practice on the same skill", async () => {
    const id = "g8.pythag";
    await D.run("DELETE FROM skill_state");
    await D.run("INSERT INTO skill_state(id,status,level,stage,since) VALUES(?,?,?,?,?)", [id, "learning", 1, 0, Date.now()]);
    const first = await E.nextItem(sessionId, "main");
    expect("example" in first && first.example.skillId).toBe(id);
    if ("example" in first) { expect(first.example.steps.length).toBeGreaterThan(0); expect(first.example.steps[0].speak).not.toMatch(/[²√]/); }
    expect("example" in (await E.nextItem(sessionId, "main"))).toBe(true); // not finished yet, so still due
    await E.completeExample(id);
    const second = await E.nextItem(sessionId, "main", id);
    expect("item" in second && second.item.mode).toBe("learn");
    expect("item" in second && second.item.calculator).toBe(true);
    // the first practice question is never the example she has just watched
    for (let i = 0; i < 40; i++) {
      const ex = await E.nextItem(sessionId, "main", id, undefined);
      const avoid = "item" in ex ? ex.item.prompt : "";
      const again = await E.nextItem(sessionId, "main", id, avoid);
      expect("item" in again && again.item.prompt).not.toBe(avoid);
    }
  });

  it("only offers and records the calculator where it is allowed", async () => {
    const pyth = await E.nextItem(sessionId, "main", "g8.pythag");
    if (!("item" in pyth)) throw new Error("expected a question");
    const r = (await E.submit(pyth.item.id, "0", 5000, true))!;
    expect((await D.one<{ calc: number }>("SELECT calc FROM attempts WHERE id = ?", [r.attemptId]))!.calc).toBe(1);
    const fact = await E.nextItem(sessionId, "facts");
    if (!("item" in fact)) throw new Error("expected a fact");
    expect(fact.item.calculator).toBe(false);
    const f = (await E.submit(fact.item.id, "0", 5000, true))!; // a client claiming calculator use on a fact is ignored
    expect((await D.one<{ calc: number }>("SELECT calc FROM attempts WHERE id = ?", [f.attemptId]))!.calc).toBe(0);
    await D.saveSettings({ calculator: false });
    const off = await E.nextItem(sessionId, "main", "g8.pythag");
    expect("item" in off && off.item.calculator).toBe(false);
    await D.saveSettings({ calculator: true });
  });

  it("reports a checkpoint at each block end of a challenge, and none at the end", async () => {
    await D.run("DELETE FROM skill_state");
    await E.startChallenge(3); // 8 questions → blocks of 4 and 4
    const seen: (number | null)[] = [];
    for (let i = 0; i < 8; i++) {
      const next = await E.nextItem(sessionId, "main");
      if (!("item" in next)) throw new Error("expected a challenge question");
      expect(next.item.progress).toMatchObject({ block: i < 4 ? 1 : 2, blocks: 2, q: (i % 4) + 1, blockSize: 4 });
      const row = await D.one<{ payload: string }>("SELECT payload FROM pending WHERE id = ?", [next.item.id]);
      const r = (await E.submit(next.item.id, JSON.parse(row!.payload).problem.answer, 5000))!;
      seen.push(r.checkpoint ? r.checkpoint.done : null);
      if (i === 7) expect(r.event).toMatchObject({ type: "challengeDone", passed: true });
    }
    expect(seen).toEqual([null, null, null, 4, null, null, null, null]);
  });

  it("logs breaks and counts them per session", async () => {
    const a = await E.startBreak(sessionId, "self"), b = await E.startBreak(sessionId, "prompted");
    await E.endBreak(a, 42); await E.endBreak(b, 60);
    const s = (await E.recentSessions()).find((x) => Number(x.id) === sessionId)!;
    expect(Number(s.breaks)).toBe(2);
    expect(Number(s.prompted)).toBe(1);
    expect(Number(s.break_seconds)).toBe(102);
  });
});
