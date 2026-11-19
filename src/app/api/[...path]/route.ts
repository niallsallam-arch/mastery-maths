import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { passcodeFor, tokenFor, requireRole, currentRole, Role } from "@/lib/auth";
import * as E from "@/lib/engine";
import { getSettings, saveSettings, one, run } from "@/lib/db";
import { explain, parentSummary, aiAvailable } from "@/lib/ai";
import { SKILL } from "@/lib/skills";

export const dynamic = "force-dynamic";
const ok = (d: unknown) => NextResponse.json(d);
const deny = () => NextResponse.json({ error: "unauthorised" }, { status: 401 });

async function handle(req: NextRequest, path: string[]) {
  const route = path.join("/");
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (route === "login") {
    const role = body.role as Role;
    if (role !== "student" && role !== "parent") return deny();
    const expected = passcodeFor(role);
    if (process.env.NODE_ENV === "production" && !process.env[role === "student" ? "STUDENT_PASSCODE" : "PARENT_PASSCODE"]) return NextResponse.json({ error: "Passcodes not configured" }, { status: 500 });
    if (String(body.passcode || "").trim().toLowerCase() !== expected.toLowerCase()) return NextResponse.json({ error: "That passcode didn't work." }, { status: 401 });
    (await cookies()).set("m_auth", tokenFor(role), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
    return ok({ role });
  }
  if (route === "logout") { (await cookies()).delete("m_auth"); return ok({}); }
  if (route === "me") return ok({ role: await currentRole() });

  if (route.startsWith("parent/")) {
    if ((await currentRole()) !== "parent") return deny();
    if (route === "parent/overview") {
      const [ov, settings, attempts] = await Promise.all([E.overview(), getSettings(), E.recentAttempts(200)]);
      return ok({ ...ov, settings, ai: aiAvailable(), attempts: attempts.map((a) => ({ ...a, skill: SKILL[a.skill_id]?.title ?? a.skill_id })) });
    }
    if (route === "parent/settings") { await saveSettings(body); return ok(await getSettings()); }
    if (route === "parent/paid") { await run("UPDATE rewards SET paid = ? WHERE id = ?", [Date.now(), body.id]); return ok({}); }
    if (route === "parent/summary") {
      const [ov, attempts] = await Promise.all([E.overview(), E.recentAttempts(400)]);
      const weekAgo = Date.now() - 7 * 86_400_000;
      const text = await parentSummary({ overview: { ...ov, rewards: undefined }, attempts: attempts.filter((a) => a.ts > weekAgo).map((a) => ({ skill: SKILL[a.skill_id]?.title ?? a.skill_id, mode: a.mode, correct: !!a.correct, seconds: Math.round(a.ms / 100) / 10, flags: a.flags, label: a.label })) });
      return ok({ text: text ?? "AI summaries need an ANTHROPIC_API_KEY." });
    }
    return deny();
  }

  if (!(await requireRole("student"))) return deny();
  switch (route) {
    case "state": {
      const [ov, s] = await Promise.all([E.overview(), getSettings()]);
      return ok({ ...ov, settings: { name: s.name, autoRead: s.autoRead, minutes: s.minutes, shortMinutes: s.shortMinutes, currency: s.currency, rewards: s.rewards } });
    }
    case "session/start": {
      const s = await getSettings();
      const minutes = body.short ? s.shortMinutes : s.minutes;
      return ok({ sessionId: await E.startSession(minutes), minutes });
    }
    case "next": return ok(await E.nextItem(Number(body.sessionId), body.segment));
    case "challenge/start": return ok({ id: await E.startChallenge(Number(body.grade)) });
    case "answer": {
      const r = await E.submit(String(body.itemId), String(body.response ?? ""), Number(body.ms) || 0);
      return r ? ok(r) : NextResponse.json({ error: "expired" }, { status: 410 });
    }
    case "explain": {
      const s = await getSettings();
      if (!s.ai) return ok({ text: null });
      const a = await one<{ prompt: string; answer: string; response: string; payload: string }>("SELECT prompt, answer, response, payload FROM attempts WHERE id = ?", [Number(body.attemptId)]);
      if (!a) return ok({ text: null });
      try {
        return ok({ text: await explain({ prompt: a.prompt, answer: a.answer, response: a.response, steps: JSON.parse(a.payload).steps, interests: s.interests }) });
      } catch (e) { console.error(e); return ok({ text: null }); }
    }
    case "explain-time": return ok(await E.recordExplainTime(Number(body.attemptId), Number(body.ms)));
    case "gamefilm": return ok({ items: await E.gameFilm(Number(body.sessionId)) });
    case "label": await E.labelAttempt(Number(body.attemptId), body.label); return ok({});
    case "tick": await E.tickSession(Number(body.sessionId), Number(body.activeMs), !!body.end); return ok({});
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return handle(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return handle(req, (await ctx.params).path); }
