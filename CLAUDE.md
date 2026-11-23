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
- Low reading load: read-aloud on every question, Lexend font, warm background, short text, visuals where possible. Facts are raced against her own best, never a punishing clock.
- Attention: short blocks, one problem per screen, instant feedback.
- Parent invisible: she should not see Niall in the app. He sets rewards and reviews the dashboard. No parent tutoring.
- Sessions: 20 minutes standard, 10-minute fallback; may stretch to 30–35 later.
- Laptop, browser. Money motivates her (reward ladder per grade, configurable in the parent dashboard).
- Learner settings (see below) are adjustable supports. Describe them only as learner settings: never name a diagnosis, a school document, or the reason for a setting in code, comments, commits, pull requests or the journal. Do not store personal or school records in the repo.

## Architecture
- Next.js 15 (App Router, TypeScript, Tailwind 4). One API catch-all: `src/app/api/[...path]/route.ts`.
- `src/lib/skills.ts`: skill map (43 skills, Grades 3–8, prerequisite links) with deterministic problem generators. Every answer is computed in code.
- `src/lib/check.ts`: answer marking (numbers, fractions incl. simplest/mixed/improper forms, remainders, choices).
- `src/lib/engine.ts`: mastery engine. Rules: mastered at ≥8 grade-level attempts, ≥90% of last 10, last correct, within fluencyMs where set. Spaced checks at 1, 7, 21 days. Below 50% over 8 → prerequisites set to "check" (gap tracing). Facts in Leitner boxes, fluent ≤3 s. Every speed target is multiplied by the `timeMultiplier` setting; the "rushed" coaching threshold is not.
- `src/lib/rules.ts`: pure rules with no database access (time multiplier, fact fluency, the mastery test, challenge block maths). `src/lib/calc.ts`: the calculator's expression evaluator (hand-written parser, no `eval`).
- `src/components/learner.tsx`: break screen, midpoint break offer, challenge checkpoint, worked example, calculator.
- `src/lib/ai.ts`: Claude API. Explanations after a wrong answer (guarded: must contain the code-computed answer, else static steps shown) and the weekly parent summary. The AI never marks.
- `src/lib/db.ts`: libSQL (local `local.db`; production Turso). Schema auto-creates. Columns added after the first release go in `ADDED_COLUMNS`, which adds each one only if it is missing, so the live database upgrades itself and keeps its rows. Never change or drop an existing column.
- `src/lib/auth.ts`: two passcodes (student, parent) via env; signed cookie.
- Pages: `/` student home, `/session` session runner (fact sprint → check-back → main → game film), `/parent` dashboard and settings (including a recent sessions table with breaks, and a "Calc" column on recent answers).
- Dev shortcut: `/session?skip=1` jumps to main work (development only).

## Settings (parent dashboard, stored in the `settings` table)
- `rewards`, `currency`, `interests`, `autoRead`, `minutes`, `shortMinutes`, `ai`, `name`.
- Learner settings: `timeMultiplier` (1.0 to 2.0, default 1.5, "Extra time on speed targets", clamped on save) and `calculator` (default on, "Calculator on applied problems").

## Learner settings (how each one works)
- Extra time: `timeMultiplier` scales the 3 s fact target and every skill's `fluencyMs`. Fact feedback shows her time against her fastest of her previous 5 correct tries on that fact.
- Breaks: "Take a break" on every question screen; a one-off offer at the session midpoint; an offer at each challenge checkpoint. A break pauses the active-time clock and is left out of the answer time; a fact is swapped for a new one afterwards. Logged in the `breaks` table (`self` or `prompted`).
- Chunked challenges: balanced blocks of at most 6 (`blockSizes`: 8 → 4+4, 14 → 5+5+4, 16 → 6+5+5). Computed from the stored `idx` and `total`, so nothing extra is saved. Checkpoints show questions completed, never the score.
- Worked example: shown once per learning period (`skill_state.example_at`, cleared whenever a skill moves to "learning"), level 1, steps one at a time with read-aloud. The first practice question is then on the same skill and is never the same problem.
- Calculator: only on skills with `calculatorOk` (g6.percent, g7.circle, g8.percentx, g8.proportion, g8.pythag). Never on a fact, arithmetic, fraction, integer or decimal operation skill; a test enforces the list. Use is recorded in `attempts.calc`.
- Reading level of AI explanations: set in the tutor prompt in `src/lib/ai.ts`.

## Build journal
- `docs/build-journal.md` documents the build for teaching others. Add a dated entry at the end of every session that changes the project.
- A reading copy of the journal and the LAC teacher skill list live in Niall's Google Drive folder `mastery-maths` (folder id `1GNPbrlNMAuTy5Eg-tiaT1o2bl_nUilvT`). After adding a journal entry, refresh the Drive copy if the Drive connector is available. The repo is the source of truth.

## Commands
- `npm install --legacy-peer-deps`
- `npm run dev` (dev passcodes: amira / parent)
- `npx vitest run` (153 tests; generators checked at 400 problems per skill per level against an independent evaluator; `tests/rules.test.ts` covers the pure rules; `tests/engine.test.ts` drives the engine against a throwaway local database)
- `npx next build`

## Conventions
- Canadian/British spelling in all UI copy. No m-dashes. Plain, calm, no superlatives.
- Any new skill needs: prerequisites, a generator for levels 1–3, steps, and must pass the generator tests.
- Never let the AI decide correctness.
- Student-facing copy never says "Grade". Grades 3–8 are shown to Amira as Levels 1–6 via `src/lib/level.ts`. The parent dashboard and the data keep real grades.

## Status and next phases
- Learner settings built 2026-11-23 (extra time, breaks, chunked challenges, worked examples, calculator, reading level).
- Phase 1 done: skill map (number, operations, fractions, decimals and percents, algebra, plus circles, squares/roots, Pythagoras), engine, sessions, challenges, rewards, parent dashboard.
- Open: confirm reward amounts and the proposal message to Amira; her interests (for AI theming); LAC teacher to review the skill list against BC curriculum.
- Deployed 2026-11-19: GitHub `main` → Vercel (auto-redeploys on merge); Turso database; env vars per `.env.example` set in Vercel. Vercel Install Command is overridden to `npm install --legacy-peer-deps`.
- Phase 2: remaining BC strands (geometry and measurement, data and probability, financial literacy); AI word problems themed to her interests with code-verified answers; fact-fluency heatmap.
- Phase 3: richer waste-meter coaching, weekly AI report by email, possible tutor voice.
