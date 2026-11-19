# Mastery Maths: project context

Private maths mastery platform for one student, Amira (Grade 8, BC, Canada). Built by her father, Niall, with Claude.
Goal: take her through Grades 3 to 8 to genuine mastery, so she is solid at Grade 8 level.

## The model (from the Peter Attia interview with the Alpha School founder)
- Age grade is not knowledge grade. Students pass grades with 70–80% and the holes compound (facts → fractions → algebra).
- Mastery bar is near 100%. A grade challenge passes only at 100% ("100 for 100").
- Missed challenge questions open hole-filling; then retake.
- Fact fluency matters: memorised facts free working memory. Careless errors usually signal a fluency gap.
- Practice difficulty near 80–85% correct; spaced repetition; retrieval practice; active not passive.
- Game film: review every miss, labelled slip vs didn't know.
- Waste meter: detect rushing and skipped explanations, coach. No chat interface (cheating risk).
- Motivation is most of it: extrinsic reward per grade passed; framing is "earn the 100", not "go back to Grade 4".
- Alpha benchmark: 20–30 hours per grade to mastery (about 22 for Grades 6 and 7 maths).

## Amira: design constraints
- Dyslexia (mild to moderate): read-aloud on every question, Lexend font, warm background, short text, visuals where possible. Facts are raced against her own best, never a punishing clock.
- Attention: short blocks, one problem per screen, instant feedback.
- Parent invisible: she should not see Niall in the app. He sets rewards and reviews the dashboard. No parent tutoring.
- Sessions: 20 minutes standard, 10-minute fallback; may stretch to 30–35 later.
- Laptop, browser. Money motivates her (reward ladder per grade, configurable in the parent dashboard).
- She has an IEP; accommodations to be checked against it once Niall shares it. Do not store IEP contents in the repo.

## Architecture
- Next.js 15 (App Router, TypeScript, Tailwind 4). One API catch-all: `src/app/api/[...path]/route.ts`.
- `src/lib/skills.ts`: skill map (43 skills, Grades 3–8, prerequisite links) with deterministic problem generators. Every answer is computed in code.
- `src/lib/check.ts`: answer marking (numbers, fractions incl. simplest/mixed/improper forms, remainders, choices).
- `src/lib/engine.ts`: mastery engine. Rules: mastered at ≥8 grade-level attempts, ≥90% of last 10, last correct, within fluencyMs where set. Spaced checks at 1, 7, 21 days. Below 50% over 8 → prerequisites set to "check" (gap tracing). Facts in Leitner boxes, fluent ≤3 s.
- `src/lib/ai.ts`: Claude API. Explanations after a wrong answer (guarded: must contain the code-computed answer, else static steps shown) and the weekly parent summary. The AI never marks.
- `src/lib/db.ts`: libSQL (local `local.db`; production Turso). Schema auto-creates.
- `src/lib/auth.ts`: two passcodes (student, parent) via env; signed cookie.
- Pages: `/` student home, `/session` session runner (fact sprint → check-back → main → game film), `/parent` dashboard and settings.
- Dev shortcut: `/session?skip=1` jumps to main work (development only).

## Commands
- `npm install --legacy-peer-deps`
- `npm run dev` (dev passcodes: amira / parent)
- `npx vitest run` (131 tests; generators checked at 400 problems per skill per level against an independent evaluator)
- `npx next build`

## Conventions
- Canadian/British spelling in all UI copy. No m-dashes. Plain, calm, no superlatives.
- Any new skill needs: prerequisites, a generator for levels 1–3, steps, and must pass the generator tests.
- Never let the AI decide correctness.

## Status and next phases
- Phase 1 done: skill map (number, operations, fractions, decimals and percents, algebra, plus circles, squares/roots, Pythagoras), engine, sessions, challenges, rewards, parent dashboard.
- Open: confirm reward amounts and the proposal message to Amira; her interests (for AI theming); IEP check; LAC teacher to review the skill list against BC curriculum.
- Deploy: GitHub → Vercel; Turso database; env vars per `.env.example`.
- Phase 2: remaining BC strands (geometry and measurement, data and probability, financial literacy); AI word problems themed to her interests with code-verified answers; fact-fluency heatmap.
- Phase 3: richer waste-meter coaching, weekly AI report by email, possible tutor voice.
