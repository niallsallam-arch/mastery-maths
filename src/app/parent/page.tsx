"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Button, Card, Login } from "@/components/ui";

type Skill = { id: string; title: string; strand: string; status: string; stage: number; level: number };
type Data = {
  grades: { grade: number; passed: boolean; mastered: number; total: number; skills: Skill[] }[];
  current: number; hoursLeft: number; activeHours: number; streak: number;
  facts: { fluent: number; total: number };
  rewards: { id: number; grade: number; amount: number; earned: number; paid: number | null }[];
  week: { attempts: number; accuracy: number | null; focus: number | null; careless: number; labelled: number };
  settings: { rewards: Record<string, number>; currency: string; interests: string; autoRead: boolean; minutes: number; shortMinutes: number; ai: boolean; name: string; timeMultiplier: number; calculator: boolean };
  ai: boolean;
  sessions: { id: number; started: number; minutes: number; active_ms: number; questions: number; breaks: number; prompted: number; break_seconds: number }[];
  attempts: { ts: number; skill: string; mode: string; correct: number; ms: number; flags: string; label: string; prompt: string; response: string; answer: string; calc: number | null }[];
};

const STATUS: Record<string, [string, string]> = {
  mastered: ["Mastered", "bg-teal text-white"], learning: ["Filling gap", "bg-gold-soft text-ink border border-gold/50"],
  check: ["Re-checking", "bg-rose-soft text-ink"], unknown: ["Not tested", "bg-paper text-soft border border-line"],
};
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

export default function Parent() {
  const [d, setD] = useState<Data | null>(null);
  const [auth, setAuth] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = () => api<Data>("parent/overview").then((x) => { setD(x); setAuth(true); }).catch(() => setAuth(false));
  useEffect(() => { load(); }, []);
  if (auth === false) return <Login role="parent" onDone={load} />;
  if (!d) return null;
  const s = d.settings, cur = s.currency;
  const owed = d.rewards.filter((r) => !r.paid);

  return (
    <main className="max-w-5xl mx-auto px-5 py-10 text-[17px]">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold">{s.name}: maths mastery</h1>
        <Link href="/" className="text-teal">Student view →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Stat l="Working on" v={`Grade ${d.current}`} />
        <Stat l="Est. hours to G8" v={`≈ ${Math.round(d.hoursLeft)}`} />
        <Stat l="Hours done" v={String(d.activeHours)} />
        <Stat l="Streak" v={`${d.streak} d`} />
        <Stat l="Fluent facts" v={`${d.facts.fluent}/${d.facts.total}`} />
        <Stat l="Rewards owed" v={`${cur}${owed.reduce((a, r) => a + r.amount, 0)}`} />
      </div>

      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Last 7 days</h2>
        <p className="text-soft mb-4">Accuracy outside fact sprints {pct(d.week.accuracy)} across {d.week.attempts} questions. Focus {pct(d.week.focus)} (share of answers not rushed and explanations not skipped). Game film: {d.week.careless} of {d.week.labelled} misses labelled as slips{d.week.labelled >= 5 && d.week.careless / d.week.labelled > 0.5 ? ", which points to fact fluency rather than understanding" : ""}.</p>
        <div className="flex gap-3 items-center">
          <Button kind="quiet" disabled={!d.ai} onClick={async () => { setSummary("Writing…"); setSummary((await api("parent/summary", {})).text); }}>AI weekly summary</Button>
          {!d.ai && <span className="text-soft">Add ANTHROPIC_API_KEY to enable.</span>}
        </div>
        {summary && <div className="mt-4 whitespace-pre-line rounded-xl bg-teal-soft p-4">{summary}</div>}
      </Card>

      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Skill map</h2>
        <div className="space-y-5">
          {d.grades.map((g) => (
            <div key={g.grade}>
              <div className="flex items-baseline gap-3 mb-2">
                <h3 className="font-semibold">Grade {g.grade}</h3>
                <span className="text-soft">{g.passed ? "Challenge passed" : "Not yet passed"} · {g.mastered}/{g.total} mastered</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.skills.map((k) => <span key={k.id} title={`${k.strand} · level ${k.level} · review stage ${k.stage}`} className={`text-sm rounded-lg px-3 py-1 ${STATUS[k.status][1]}`}>{k.title}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5 text-sm">{Object.entries(STATUS).map(([k, [l, c]]) => <span key={k} className={`rounded-lg px-3 py-1 ${c}`}>{l}</span>)}</div>
      </Card>

      {d.rewards.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Rewards</h2>
          {d.rewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
              <span>Grade {r.grade} challenge, {new Date(r.earned).toLocaleDateString("en-CA")}: {cur}{r.amount}</span>
              {r.paid ? <span className="text-soft">Paid {new Date(r.paid).toLocaleDateString("en-CA")}</span> : <Button kind="quiet" onClick={async () => { await api("parent/paid", { id: r.id }); load(); }}>Mark paid</Button>}
            </div>
          ))}
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <form className="grid md:grid-cols-2 gap-5" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const rewards: Record<string, number> = {};
          for (const g of [3, 4, 5, 6, 7, 8]) rewards[String(g)] = Number(f.get(`r${g}`)) || 0;
          await api("parent/settings", { rewards, currency: f.get("currency"), interests: f.get("interests"), autoRead: f.get("autoRead") === "on", ai: f.get("ai") === "on", minutes: Number(f.get("minutes")), shortMinutes: Number(f.get("shortMinutes")), name: f.get("name"), timeMultiplier: Number(f.get("timeMultiplier")), calculator: f.get("calculator") === "on" });
          setSaved(true); setTimeout(() => setSaved(false), 2000); load();
        }}>
          <fieldset>
            <legend className="font-medium mb-2">Reward for 100% on each grade</legend>
            <div className="grid grid-cols-3 gap-2">
              {[3, 4, 5, 6, 7, 8].map((g) => <label key={g} className="text-sm">Grade {g}<input name={`r${g}`} type="number" min={0} defaultValue={s.rewards[String(g)] ?? 0} className="block w-full border border-line rounded-lg px-2 py-1 bg-paper" /></label>)}
            </div>
            <label className="text-sm block mt-2">Currency symbol <input name="currency" defaultValue={cur} className="w-16 border border-line rounded-lg px-2 py-1 bg-paper" /></label>
          </fieldset>
          <div className="space-y-3">
            <label className="block text-sm">Her interests (used to theme AI explanations)<textarea name="interests" defaultValue={s.interests} rows={2} className="block w-full border border-line rounded-lg px-2 py-1 bg-paper" /></label>
            <div className="flex gap-4">
              <label className="text-sm">Session minutes<input name="minutes" type="number" min={5} max={60} defaultValue={s.minutes} className="block w-24 border border-line rounded-lg px-2 py-1 bg-paper" /></label>
              <label className="text-sm">Fallback minutes<input name="shortMinutes" type="number" min={5} max={30} defaultValue={s.shortMinutes} className="block w-24 border border-line rounded-lg px-2 py-1 bg-paper" /></label>
              <label className="text-sm">Name<input name="name" defaultValue={s.name} className="block w-32 border border-line rounded-lg px-2 py-1 bg-paper" /></label>
            </div>
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="autoRead" defaultChecked={s.autoRead} /> Read every question aloud automatically</label>
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="ai" defaultChecked={s.ai} /> AI explanations after a wrong answer</label>
          </div>
          <fieldset className="md:col-span-2 border-t border-line pt-4">
            <legend className="font-medium mb-2">Learner settings</legend>
            <div className="flex flex-wrap gap-x-8 gap-y-3 items-end">
              <label className="text-sm">Extra time on speed targets<input name="timeMultiplier" type="number" min={1} max={2} step={0.1} defaultValue={s.timeMultiplier} className="block w-24 border border-line rounded-lg px-2 py-1 bg-paper" /><span className="text-soft">1.0 to 2.0. Fact target is now {Math.round(3 * s.timeMultiplier * 10) / 10} s.</span></label>
              <label className="flex gap-2 items-center text-sm pb-6"><input type="checkbox" name="calculator" defaultChecked={s.calculator} /> Calculator on applied problems</label>
            </div>
          </fieldset>
          <div><Button type="submit">{saved ? "Saved" : "Save settings"}</Button></div>
        </form>
      </Card>

      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Recent sessions</h2>
        {d.sessions.length === 0 ? <p className="text-soft">No sessions yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-soft text-left"><tr><th className="py-1">When</th><th>Planned</th><th>Active</th><th>Questions</th><th>Breaks</th><th>Break time</th></tr></thead>
              <tbody>
                {d.sessions.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className="py-1 pr-2 whitespace-nowrap">{new Date(x.started).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="pr-2">{x.minutes} min</td><td className="pr-2">{Math.round(x.active_ms / 60_000)} min</td><td className="pr-2">{x.questions}</td>
                    <td className="pr-2">{x.breaks}{x.prompted > 0 ? ` (${x.prompted} prompted)` : ""}</td><td>{x.breaks ? `${Math.round(x.break_seconds / 6) / 10} min` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-3">Recent answers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-soft text-left"><tr><th className="py-1">When</th><th>Skill</th><th>Mode</th><th>Question</th><th>Her answer</th><th>Right</th><th>Secs</th><th>Calc</th><th>Flags</th></tr></thead>
            <tbody>
              {d.attempts.slice(0, 80).map((a, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1 pr-2 whitespace-nowrap">{new Date(a.ts).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="pr-2">{a.skill}</td><td className="pr-2">{a.mode}</td><td className="pr-2">{a.prompt}</td>
                  <td className={`pr-2 ${a.correct ? "" : "text-rose"}`}>{a.response}</td><td className="pr-2">{a.correct ? "✓" : a.answer}</td>
                  <td className="pr-2">{(a.ms / 1000).toFixed(1)}</td><td className="pr-2">{a.calc ? "Used" : ""}</td><td>{[a.flags?.replace(/^,/, ""), a.label].filter(Boolean).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return <div className="rounded-2xl p-4 border border-line bg-card"><div className="text-sm text-soft">{l}</div><div className="text-xl font-semibold">{v}</div></div>;
}
