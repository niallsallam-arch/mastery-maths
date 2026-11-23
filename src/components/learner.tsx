"use client";
// Screens for the learner settings: breaks, challenge checkpoints, worked examples and the calculator.
import { useEffect, useRef, useState } from "react";
import { Button, Card, FractionBar, SpeakButton } from "@/components/ui";
import { evaluate, show } from "@/lib/calc";

export const BREAK_SECONDS = 60;

/** A calm one-minute pause. She can come back early; when the minute is up it waits for her. */
export function BreakScreen({ onDone }: { onDone: () => void }) {
  const [left, setLeft] = useState(BREAK_SECONDS);
  useEffect(() => { const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000); return () => clearInterval(t); }, []);
  return (
    <Card className="pop text-center py-12">
      <div className="text-soft uppercase tracking-wider text-sm mb-2">Break</div>
      {left > 0 ? (
        <>
          <div className="text-6xl font-semibold text-teal mb-6" aria-live="off">0:{String(left).padStart(2, "0")}</div>
          <ul className="text-xl space-y-2 mb-8">
            <li>Stand up.</li>
            <li>Stretch.</li>
            <li>Have a drink of water.</li>
          </ul>
        </>
      ) : (
        <p className="text-2xl my-8">Break done. Come back when you are ready.</p>
      )}
      <Button onClick={onDone} className="text-xl px-8 py-4">Back to it</Button>
    </Card>
  );
}

/** Offered once, half way through the session. */
export function MidpointOffer({ onBreak, onContinue }: { onBreak: () => void; onContinue: () => void }) {
  return (
    <Card className="pop text-center py-10">
      <h2 className="text-3xl font-semibold mb-6">Halfway. Want a 1-minute break?</h2>
      <div className="flex justify-center gap-3">
        <Button onClick={onBreak} className="text-xl px-8 py-4">Yes</Button>
        <Button kind="quiet" onClick={onContinue} className="text-xl px-8 py-4">Keep going</Button>
      </div>
    </Card>
  );
}

/** Between challenge blocks. Shows how far she is, never the score. */
export function Checkpoint({ block, blocks, done, total, onBreak, onContinue }: { block: number; blocks: number; done: number; total: number; onBreak: () => void; onContinue: () => void }) {
  return (
    <Card className="pop text-center py-10">
      <div className="text-soft uppercase tracking-wider text-sm">Checkpoint</div>
      <h2 className="text-4xl font-semibold my-2">Block {block} of {blocks} done</h2>
      <p className="text-xl mb-4">{done} of {total} questions completed.</p>
      <div className="flex justify-center gap-2 mb-8" aria-hidden>
        {Array.from({ length: blocks }, (_, i) => <span key={i} className={`h-3 w-14 rounded-full ${i < block ? "bg-teal" : "bg-line"}`} />)}
      </div>
      <div className="flex justify-center gap-3">
        <Button kind="quiet" onClick={onBreak} className="text-xl px-6 py-4">Take a 1-minute break</Button>
        <Button onClick={onContinue} className="text-xl px-8 py-4">Keep going</Button>
      </div>
    </Card>
  );
}

export type Example = { skillId: string; skillTitle: string; prompt: string; speak: string; unit?: string; visual?: { type: "fractionBar"; parts: number; shaded: number }; steps: { text: string; speak: string }[] };

/** One solved problem, a step at a time, before she tries the skill herself. Nothing here is marked. */
export function WorkedExample({ example, onDone }: { example: Example; onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const all = shown >= example.steps.length;
  return (
    <Card className="pop">
      <div className="flex justify-between items-center text-soft text-base mb-4">
        <span>{example.skillTitle}</span>
        <span>Worked example</span>
      </div>
      <p className="text-soft mb-3">Watch this one first. Then it is your turn.</p>
      <div className="flex items-start gap-4 mb-6">
        <SpeakButton text={example.speak} />
        <div className={`problem ${example.prompt.length > 40 ? "long" : ""}`}>{example.prompt}</div>
      </div>
      {example.visual?.type === "fractionBar" && <div className="mb-6"><FractionBar parts={example.visual.parts} shaded={example.visual.shaded} /></div>}
      <ol className="space-y-3 mb-6">
        {example.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="pop flex items-center gap-3 rounded-xl bg-teal-soft px-4 py-3">
            <SpeakButton text={s.speak} />
            <span className="text-soft w-16 shrink-0">Step {i + 1}</span>
            <span className="text-xl">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-4">
        {all ? <Button onClick={onDone} className="text-xl px-8 py-4">Now you try</Button> : <Button onClick={() => setShown((n) => n + 1)} className="text-xl px-8 py-4">Next step</Button>}
        <span className="text-soft text-base">Step {Math.min(shown, example.steps.length)} of {example.steps.length}</span>
      </div>
    </Card>
  );
}

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "√", "+"];

/** A simple calculator for applied problems. It works things out; it never fills in the answer box. */
export function Calculator({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const press = (k: string) => { setOut(null); setExpr((e) => e + k); input.current?.focus(); };
  const equals = () => { if (!expr.trim()) return; const v = evaluate(expr); setOut(v === null ? "Check what you typed" : `= ${show(v)}`); };

  if (!open) return <Button kind="quiet" onClick={() => { setOpen(true); onOpen(); }}>Calculator</Button>;
  return (
    <div className="pop rounded-2xl border border-line bg-paper p-4 w-full max-w-xs" role="group" aria-label="Calculator">
      <div className="flex justify-between items-center mb-2">
        <span className="text-soft text-base">Calculator</span>
        <span className="flex gap-4">
          <button type="button" onClick={() => { setExpr(""); setOut(null); input.current?.focus(); }} className="text-teal hover:text-ink text-base">Clear</button>
          <button type="button" onClick={() => setOpen(false)} className="text-soft hover:text-ink text-base">Hide</button>
        </span>
      </div>
      <input ref={input} autoFocus value={expr} aria-label="Calculator input" autoComplete="off" spellCheck={false} inputMode="decimal"
        onChange={(e) => { setOut(null); setExpr(e.target.value.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").replace(/[^0-9.+−×÷√() ]/g, "")); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "=") { e.preventDefault(); equals(); } }}
        className="w-full text-2xl text-right border-2 border-line focus:border-teal outline-none rounded-xl px-3 py-2 bg-card" />
      <div className="h-9 text-2xl text-right font-semibold text-teal px-1" aria-live="polite">{out}</div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => <button key={k} type="button" onClick={() => press(k)} className="h-12 rounded-xl border border-line bg-card text-xl hover:border-teal">{k}</button>)}
        {["(", ")"].map((k) => <button key={k} type="button" onClick={() => press(k)} className="h-12 rounded-xl border border-line bg-card text-xl hover:border-teal">{k}</button>)}
        <button type="button" onClick={() => { setExpr((e) => e.slice(0, -1)); setOut(null); input.current?.focus(); }} aria-label="Delete last" className="h-12 rounded-xl border border-line bg-card text-xl hover:border-teal">⌫</button>
        <button type="button" onClick={equals} aria-label="Equals" className="h-12 rounded-xl bg-teal text-white text-xl hover:brightness-110">=</button>
      </div>
    </div>
  );
}
