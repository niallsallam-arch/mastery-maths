"use client";
import { ReactNode, useEffect, useState } from "react";

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error || "Request failed"), { status: r.status });
  return j;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card border border-line rounded-2xl p-6 ${className}`}>{children}</div>;
}
export function Button({ children, onClick, kind = "primary", className = "", disabled, type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "quiet" | "gold"; className?: string; disabled?: boolean; type?: "button" | "submit" }) {
  const k = kind === "primary" ? "bg-teal text-white hover:brightness-110" : kind === "gold" ? "bg-gold text-white hover:brightness-110" : "bg-transparent text-teal border border-line hover:bg-teal-soft";
  return <button type={type} disabled={disabled} onClick={onClick} className={`rounded-xl px-5 py-3 font-medium transition disabled:opacity-40 ${k} ${className}`}>{children}</button>;
}

/** Read-aloud using the browser's built-in voices (Chrome on a laptop has good ones). */
export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-CA") || voices.find((v) => v.lang === "en-GB" && /female|Google/i.test(v.name)) || voices.find((v) => v.lang.startsWith("en")) || null;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
export function SpeakButton({ text }: { text: string }) {
  return (
    <button aria-label="Read it to me" title="Read it to me" onClick={() => speak(text)} className="shrink-0 rounded-full w-12 h-12 grid place-items-center bg-teal-soft text-teal hover:brightness-95">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
    </button>
  );
}

export function FractionBar({ parts, shaded }: { parts: number; shaded: number }) {
  const w = 420, h = 64, pw = w / parts;
  return (
    <svg viewBox={`0 0 ${w + 4} ${h + 4}`} className="w-full max-w-md" role="img" aria-label={`A bar in ${parts} equal parts`}>
      {Array.from({ length: parts }, (_, i) => <rect key={i} x={2 + i * pw} y={2} width={pw} height={h} fill={i < shaded ? "var(--teal)" : "white"} stroke="var(--ink)" strokeWidth={2} />)}
    </svg>
  );
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

export function Login({ role, onDone }: { role: "student" | "parent"; onDone: () => void }) {
  const [code, setCode] = useState(""), [err, setErr] = useState("");
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">{role === "student" ? "Mastery Maths" : "Parent dashboard"}</h1>
        <p className="text-soft mb-5">Type your passcode.</p>
        <form onSubmit={async (e) => { e.preventDefault(); try { await api("login", { role, passcode: code }); onDone(); } catch (x: any) { setErr(x.message); } }}>
          <input autoFocus type="password" value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-line rounded-xl px-4 py-3 mb-3 text-xl bg-paper" />
          {err && <p className="text-rose mb-3">{err}</p>}
          <Button type="submit" className="w-full">Go</Button>
        </form>
      </Card>
    </main>
  );
}
