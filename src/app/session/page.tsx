"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Button, Card, FractionBar, SpeakButton, speak } from "@/components/ui";

type Item = { id: string; mode: string; skillTitle?: string; grade?: number; prompt: string; speak: string; kind: string; choices?: string[]; unit?: string; visual?: { type: "fractionBar"; parts: number; shaded: number }; progress?: { idx: number; total: number } };
type Intro = { grade: number; total: number; reward: number; currency: string; retake: boolean };
type Result = { correct: boolean; answer: string; feedback?: string; steps: string[]; attemptId: number; coach?: string; factMs?: number; fluent?: boolean; event?: any };
type FilmItem = { id: number; prompt: string; answer: string; response: string };
type Segment = "facts" | "review" | "main";

const SEG_LABEL: Record<string, string> = { facts: "Fact sprint", review: "Quick check-back", main: "Main work", film: "Game film" };

export default function Page() { return <Suspense><Session /></Suspense>; }

function Session() {
  const router = useRouter();
  const params = useSearchParams();
  const short = params.get("m") === "short";
  const devSkip = process.env.NODE_ENV !== "production" && params.get("skip") === "1"; // dev only: start at main work
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [autoRead, setAutoRead] = useState(false);
  const [phase, setPhase] = useState<"loading" | "item" | "feedback" | "intro" | "challengeDone" | "film" | "summary">("loading");
  const [segment, setSegment] = useState<Segment | "film">("facts");
  const [item, setItem] = useState<Item | null>(null);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [aiText, setAiText] = useState<string | null | undefined>(undefined);
  const [answer, setAnswer] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [film, setFilm] = useState<FilmItem[]>([]);
  const [stats, setStats] = useState({ n: 0, c: 0, fast: 0, mastered: [] as string[] });
  const [idle, setIdle] = useState(false);

  const active = useRef(0), lastInput = useRef(Date.now()), shownAt = useRef(0), feedbackAt = useRef(0), busy = useRef(false), reviewEmpty = useRef(false);
  const total = minutes * 60_000;
  const bounds = { facts: Math.max(2, Math.round(minutes * 0.15)) * 60_000, review: 0, film: total - Math.max(1, Math.round(minutes * 0.1)) * 60_000 };
  bounds.review = bounds.facts + Math.max(1, Math.round(minutes * 0.15)) * 60_000;

  // Active-time clock: only counts while the tab is visible and she has touched the keyboard or mouse in the last minute.
  useEffect(() => {
    const touch = () => { lastInput.current = Date.now(); setIdle(false); };
    window.addEventListener("keydown", touch); window.addEventListener("pointerdown", touch);
    const t = setInterval(() => {
      const quiet = Date.now() - lastInput.current;
      if (document.visibilityState === "visible" && quiet < 60_000) active.current += 1000;
      if (quiet > 45_000) setIdle(true);
    }, 1000);
    return () => { clearInterval(t); window.removeEventListener("keydown", touch); window.removeEventListener("pointerdown", touch); };
  }, []);
  useEffect(() => { if (!sessionId) return; const t = setInterval(() => api("tick", { sessionId, activeMs: active.current }).catch(() => {}), 30_000); return () => clearInterval(t); }, [sessionId]);

  useEffect(() => {
    (async () => {
      try {
        const st = await api("state"); setAutoRead(st.settings.autoRead);
        const s = await api("session/start", { short }); setMinutes(s.minutes);
        if (devSkip) { active.current = Math.round(s.minutes * 0.3) * 60_000 + 60_000; reviewEmpty.current = true; }
        setSessionId(s.sessionId);
      } catch { router.push("/"); }
    })();
  }, [short, router, devSkip]);

  const pickSegment = useCallback((): Segment | "film" => {
    const a = active.current;
    if (a < bounds.facts) return "facts";
    if (a < bounds.review && !reviewEmpty.current) return "review";
    if (a < bounds.film) return "main";
    return "film";
  }, [bounds.facts, bounds.review, bounds.film]);

  const advance = useCallback(async () => {
    if (!sessionId) return;
    const seg = pickSegment();
    setSegment(seg);
    setResult(null); setAiText(undefined); setAnswer(""); setFlash(null);
    if (seg === "film") {
      const f = await api<{ items: FilmItem[] }>("gamefilm", { sessionId });
      setFilm(f.items); setPhase(f.items.length ? "film" : "summary");
      if (!f.items.length) api("tick", { sessionId, activeMs: active.current, end: true });
      return;
    }
    const r = await api("next", { sessionId, segment: seg });
    if (r.empty) { reviewEmpty.current = true; return advance(); }
    if (r.intro) { setIntro(r.intro); setPhase("intro"); return; }
    if (r.item) { setItem(r.item); setPhase("item"); shownAt.current = Date.now(); if (autoRead) speak(r.item.speak); }
  }, [sessionId, pickSegment, autoRead]);

  useEffect(() => { if (sessionId) advance(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(resp: string) {
    if (!item || busy.current || !resp.trim()) return;
    busy.current = true;
    try {
      const r = await api<Result>("answer", { itemId: item.id, response: resp, ms: Date.now() - shownAt.current });
      setStats((s) => ({ n: s.n + 1, c: s.c + (r.correct ? 1 : 0), fast: s.fast + (r.fluent ? 1 : 0), mastered: r.event?.type === "mastered" ? [...s.mastered, r.event.skill] : s.mastered }));
      if (r.event?.type === "mastered") showToast(`Mastered: ${r.event.skill}`);
      if (r.event?.type === "traced") showToast(`Let's shore up the basics first: ${r.event.skills.join(", ")}`);
      if (r.event?.type === "reopened") showToast(`${r.event.skill} needs a refresh. Back on the list.`);
      if (r.event?.type === "challengeDone") { setResult(r); setPhase("challengeDone"); return; }
      if (r.correct && !r.feedback) {
        setFlash(r.fluent ? `Correct · ${(r.factMs! / 1000).toFixed(1)} s ⚡` : r.factMs ? `Correct · ${(r.factMs / 1000).toFixed(1)} s` : "Correct");
        setTimeout(() => { busy.current = false; advance(); }, item.mode === "fact" ? 550 : 900);
        return;
      }
      setResult(r); setPhase("feedback"); feedbackAt.current = Date.now();
      if (item.mode !== "fact" && !r.feedback?.startsWith("Right amount")) {
        api<{ text: string | null }>("explain", { attemptId: r.attemptId }).then((x) => setAiText(x.text)).catch(() => setAiText(null));
      } else setAiText(null);
    } catch { busy.current = false; showToast("Something went wrong saving that. Try again."); }
  }

  async function gotIt() {
    if (result && item?.mode !== "fact") {
      const r = await api<{ skipped: boolean }>("explain-time", { attemptId: result.attemptId, ms: Date.now() - feedbackAt.current });
      if (r.skipped) showToast("Read the explanation through before moving on. That's where the learning happens.");
    }
    busy.current = false; advance();
  }
  function showToast(t: string) { setToast(t); setTimeout(() => setToast(null), 4500); }

  const pct = Math.min(100, (active.current / total) * 100);

  return (
    <main className="max-w-3xl mx-auto px-5 py-6">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-soft hover:text-ink text-base">← Home</Link>
        <div className="flex-1 h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-teal transition-all duration-1000" style={{ width: `${pct}%` }} /></div>
        <span className="text-soft text-base w-36 text-right">{SEG_LABEL[segment]}</span>
      </header>

      {toast && <div className="pop mb-4 rounded-xl bg-gold-soft border border-gold/40 px-4 py-3">{toast}</div>}

      {phase === "item" && item && (
        <Card className="pop">
          <div className="flex justify-between items-center text-soft text-base mb-4">
            <span>{item.mode === "fact" ? "Fast facts: aim for under 3 seconds" : item.skillTitle}</span>
            {item.progress && <span>Question {item.progress.idx + 1} of {item.progress.total}</span>}
          </div>
          <div className="flex items-start gap-4 mb-6">
            <SpeakButton text={item.speak} />
            <div className={`problem ${item.prompt.length > 40 ? "long" : ""}`}>{item.prompt}</div>
          </div>
          {item.visual?.type === "fractionBar" && <div className="mb-6"><FractionBar parts={item.visual.parts} shaded={item.visual.shaded} /></div>}
          {flash ? (
            <div className="pop text-2xl font-semibold text-teal py-3">{flash}</div>
          ) : item.kind === "choice" ? (
            <div className="flex gap-3">{item.choices!.map((c) => <button key={c} onClick={() => submit(c)} className="big-answer w-24 h-20 rounded-xl border-2 border-line hover:border-teal bg-paper">{c}</button>)}</div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(answer); }} className="flex items-center gap-3">
              {item.unit === "$" && <span className="big-answer text-soft">$</span>}
              <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Your answer"
                className="big-answer w-full max-w-xs border-2 border-line focus:border-teal outline-none rounded-xl px-4 py-2 bg-paper" />
              {item.unit && item.unit !== "$" && <span className="big-answer text-soft">{item.unit}</span>}
              <Button type="submit" className="text-xl px-6 py-4">Check</Button>
            </form>
          )}
          {item.kind === "fraction" && !flash && <p className="text-soft text-base mt-3">Type fractions like 3/4, and mixed numbers like 1 3/4.</p>}
          {idle && !flash && <p className="text-soft text-base mt-4">Stuck? Tap the speaker to hear it again, or give it your best try. A wrong answer is useful.</p>}
        </Card>
      )}

      {phase === "feedback" && result && item && (
        <Card className="pop">
          <div className="text-soft text-base mb-2">{item.prompt}</div>
          {result.feedback?.startsWith("Right amount") ? (
            <p className="text-xl mb-4">{result.feedback}</p>
          ) : (
            <>
              <p className="text-xl mb-1">You put <span className="font-semibold">{answer || "—"}</span>. The answer is <span className="font-semibold text-teal">{item.unit === "$" ? "$" : ""}{result.answer}{item.unit && item.unit !== "$" ? ` ${item.unit}` : ""}</span>.</p>
              {result.feedback && <p className="text-soft mb-2">{result.feedback}</p>}
            </>
          )}
          {result.coach && <p className="rounded-xl bg-rose-soft px-4 py-2 my-3">{result.coach}</p>}
          {item.mode !== "fact" && (
            <div className="rounded-xl bg-teal-soft px-5 py-4 my-4">
              {aiText === undefined ? <p className="text-soft">Working out the clearest way to explain it…</p> : (
                <div className="flex gap-3 items-start">
                  <SpeakButton text={aiText ?? result.steps.join(". ")} />
                  <div className="whitespace-pre-line">{aiText ?? result.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}</div>
                </div>
              )}
            </div>
          )}
          <Button onClick={gotIt} className="mt-2">{item.mode === "fact" ? "Next" : "Got it. Try another"}</Button>
        </Card>
      )}

      {phase === "intro" && intro && (
        <Card className="pop text-center py-10">
          <div className="text-soft uppercase tracking-wider text-sm">{intro.retake ? "Retake" : "Challenge"}</div>
          <h2 className="text-4xl font-semibold my-2">Grade {intro.grade}</h2>
          <p className="text-xl mb-1">{intro.total} questions. Get every one right to pass.</p>
          {intro.reward > 0 && <p className="text-2xl font-semibold text-gold mb-6">100% earns {intro.currency}{intro.reward}</p>}
          <p className="text-soft mb-6">No rush. You can stop part way and carry on next time.</p>
          <Button kind="gold" className="text-xl px-8 py-4" onClick={async () => { await api("challenge/start", { grade: intro.grade }); advance(); }}>Start the challenge</Button>
        </Card>
      )}

      {phase === "challengeDone" && result?.event && (
        <Card className="pop text-center py-10">
          {result.event.passed ? (
            <>
              <h2 className="text-4xl font-semibold mb-2">Grade {result.event.grade}: 100%</h2>
              {result.event.reward > 0 && <p className="text-3xl font-semibold text-gold mb-4">You earned {result.event.currency}{result.event.reward}</p>}
              <p className="text-xl mb-6">Passed. On to Grade {Math.min(8, result.event.grade + 1)}.</p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-semibold mb-2">Grade {result.event.grade}: {result.event.correct} of {result.event.total}</h2>
              <p className="text-xl mb-2">{result.event.total - result.event.correct <= 3 ? "Close." : "Good map of where to work."} Fill these, then retake for the 100:</p>
              <ul className="mb-6">{result.event.holes.map((h: string) => <li key={h} className="text-lg">• {h}</li>)}</ul>
            </>
          )}
          <Button onClick={() => { busy.current = false; advance(); }}>Keep going</Button>
        </Card>
      )}

      {phase === "film" && film[0] && (
        <Card className="pop">
          <h2 className="text-xl font-semibold mb-1">Game film</h2>
          <p className="text-soft mb-5">Look back at one you missed today. Be honest. It helps the app send you the right practice.</p>
          <div className="problem long mb-2">{film[0].prompt}</div>
          <p className="text-xl mb-6">You put <b>{film[0].response}</b>. The answer was <b className="text-teal">{film[0].answer}</b>.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => label("careless")}>I knew it. I slipped</Button>
            <Button kind="quiet" onClick={() => label("didnt_know")}>I didn&apos;t know how</Button>
          </div>
        </Card>
      )}

      {phase === "summary" && (
        <Card className="pop text-center py-10">
          <h2 className="text-3xl font-semibold mb-4">Done for today</h2>
          <p className="text-xl">{stats.n} questions · {stats.c} correct{stats.fast ? ` · ${stats.fast} lightning facts` : ""}</p>
          {stats.mastered.length > 0 && <p className="text-xl mt-3">Mastered today: {stats.mastered.join(", ")}</p>}
          <Link href="/" className="inline-block mt-8"><Button>Back home</Button></Link>
        </Card>
      )}
    </main>
  );

  async function label(l: "careless" | "didnt_know") {
    await api("label", { attemptId: film[0].id, label: l });
    const rest = film.slice(1); setFilm(rest);
    if (!rest.length) { setPhase("summary"); api("tick", { sessionId, activeMs: active.current, end: true }); }
  }
}
