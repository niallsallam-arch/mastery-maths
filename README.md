# Mastery Maths

A private maths mastery platform for one student, built on the Alpha School mastery model:
grade challenges passed only at 100%, hole-filling for every miss, fact fluency to speed,
spaced re-checks, game film, and a focus (waste) meter. Content follows the BC Mathematics
curriculum, Grades 3 to 8 (number, operations, fractions, decimals and percents, algebra, plus
circles, squares and roots, and the Pythagorean theorem).

## How a session runs (20 minutes standard, 10 minute fallback)
1. Fact sprint (about 15%): multiplication and division to 12 × 12, trained to under 3 seconds (Leitner boxes).
2. Check-back (up to 15%): spaced re-checks of mastered skills at 1, 7 and 21 days.
3. Main work: grade challenge, or hole-filling on skills missed in a challenge.
4. Game film (last 10%): she labels each miss as a slip or "didn't know how".

Only active time counts (tab visible, input within the last minute).

## Rules
- Grade challenge: 2 questions per skill at grade standard. 100% passes the grade and records the reward.
- A missed skill reopens for practice. Mastery: at least 8 grade-level questions, 90%+ of the last 10, last one right, within the speed limit for fluency skills.
- Difficulty adapts per skill to keep her near 80–85% correct.
- Below 50% over 8 questions: the skill's prerequisites are re-checked (traces gaps downward).
- Every answer is computed and marked in code. Claude only explains (after a wrong answer, with a guard that the explanation contains the correct answer) and writes the weekly parent summary. There is no chat box.

## Run locally
    npm install --legacy-peer-deps
    npm run dev          # http://localhost:3000  (dev passcodes: amira / parent)
    npx vitest run       # 131 tests: every generator, 400 problems per skill per level

## Deploy (Vercel + Turso)
1. Push this folder to a private GitHub repo.
2. Create a Turso database (free tier): `turso db create mastery`, then get its URL and a token.
3. Import the repo in Vercel and set the environment variables in `.env.example`.
4. Open `/` for Amira and `/parent` for the dashboard.
