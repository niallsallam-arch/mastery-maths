"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Card, Login } from "@/components/ui";

type Grade = { grade: number; passed: boolean; mastered: number; total: number };
type State = {
  grades: Grade[]; current: number; hoursLeft: number; activeHours: number; streak: number;
  facts: { fluent: number; total: number };
  rewards: { amount: number; paid: number | null }[];
  settings: { name: string; minutes: number; shortMinutes: number; currency: string; rewards: Record<string, number> };
};

export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [auth, setAuth] = useState<boolean | null>(null);
  const load = () => api<State>("state").then((x) => { setS(x); setAuth(true); }).catch(() => setAuth(false));
  useEffect(() => { load(); }, []);
  if (auth === false) return <Login role="student" onDone={load} />;
  if (!s) return null;
  const earned = s.rewards.reduce((a, r) => a + r.amount, 0);
  const cur = s.settings.currency;
  const allDone = s.grades.every((g) => g.passed);

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-semibold mb-1">Hi {s.settings.name}</h1>
      <p className="text-soft mb-8">{allDone ? "Every grade is passed. Keep it sharp." : `Next up: the Grade ${s.current} Challenge path.`}</p>

      <div className="grid sm:grid-cols-[2fr_1fr] gap-4 mb-8">
        <Link href={`/session?m=standard`} className="block rounded-2xl bg-teal text-white p-6 hover:brightness-110">
          <div className="text-sm uppercase tracking-wider opacity-80">Today</div>
          <div className="text-3xl font-semibold mt-1">Start {s.settings.minutes} minutes</div>
        </Link>
        <Link href={`/session?m=short`} className="block rounded-2xl border border-line bg-card p-6 hover:bg-teal-soft">
          <div className="text-sm uppercase tracking-wider text-soft">Short on time</div>
          <div className="text-2xl font-semibold mt-1 text-teal">{s.settings.shortMinutes} minutes</div>
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-semibold">100 for 100</h2>
          <span className="text-soft text-base">Score 100% on a grade to pass it</span>
        </div>
        <ol className="grid grid-cols-6 gap-2">
          {s.grades.map((g) => {
            const isCur = !g.passed && g.grade === s.current;
            return (
              <li key={g.grade} className={`rounded-xl p-3 text-center border ${g.passed ? "bg-teal text-white border-teal" : isCur ? "bg-gold-soft border-gold" : "border-line text-soft"}`}>
                <div className="text-xs uppercase tracking-wider">Grade</div>
                <div className="text-2xl font-semibold">{g.grade}</div>
                <div className="text-sm">{g.passed ? "Passed" : `${cur}${s.settings.rewards[String(g.grade)] ?? 0}`}</div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Hours to Grade 8" value={allDone ? "0" : `≈ ${Math.max(1, Math.round(s.hoursLeft))}`} />
        <Stat label="Day streak" value={String(s.streak)} />
        <Stat label="Fast facts" value={`${s.facts.fluent}/${s.facts.total}`} />
        <Stat label="Earned" value={`${cur}${earned}`} gold />
      </div>
    </main>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${gold ? "bg-gold-soft border-gold/40" : "bg-card border-line"}`}>
      <div className="text-sm text-soft">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
