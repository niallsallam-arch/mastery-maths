# Build journal: Mastery Maths with Claude Code

A running record of how this app was built with Claude, written so it can later become a guide for others. Each entry: what we did, why, and what was learned. Newest entries at the bottom.

Claude: at the end of any session that changes the project, add a dated entry here (what was done, decisions made, lessons for a first-time builder). Keep it plain English. No m-dashes.

---

## 2026-11-18 · 1. From podcast to product brief (Claude chat, in a Project)

**What happened.** Uploaded the transcript of Peter Attia's interview with the Alpha School founder and asked Claude to extract the mastery thesis for maths: age grade versus knowledge grade, the 100% bar, fact fluency and working memory, 20–30 hours per grade, game film, the waste meter, and motivation via "100 for 100".

**Decisions.** Build a private web app for one student. Answers are computed by code, never by the AI; the AI only explains. No chat box. Sessions of 20 minutes with a 10-minute fallback. Laptop browser. Hosted privately. Money as the reward.

**Lesson.** Answer the clarifying questions before any build starts (curriculum, device, hosting, AI use, motivation, time budget). Each answer changed the design.

## 2026-11-18 · 2. Phase 1 built in one session

**What happened.** Claude scaffolded a Next.js app and built: a skill map of 43 BC curriculum skills (Grades 3–8) with prerequisite links; problem generators; answer marking; the mastery engine; the session runner; grade challenges with rewards; and a parent dashboard.

**How it was checked.** 131 automated tests (400 generated problems per skill per difficulty level, each checked by an independent calculator), a scripted play-through of the whole engine, and screenshots of every screen.

**Lesson.** Ask for tests and screenshots as proof, not a description of what was built. One bug (a decimal being accepted where a fraction was asked for) was caught this way.

## 2026-11-18 · 3. Moving from chat to Claude Code

**Why.** A chat session's workspace is temporary and private to that conversation: you can't run the app yourself, and the code doesn't persist. Claude Code works on a real repository that persists, can be run and previewed, and deploys.

**Steps.**
1. Created an empty private GitHub repository (`mastery-maths`), with no README, so the existing code could be pushed into it.
2. Claude pushed the code and added `CLAUDE.md`, a project brief that Claude Code reads at the start of every session.
3. Opened the repository in Claude Code (see the next entry).

**Lesson.** `CLAUDE.md` is the project's memory. Anything a future session must know (rules, constraints, conventions, what's next) goes there, not in chat.

## 2026-11-19 · 4. Deploying to Vercel

**Before the session.** In the Claude Code desktop app, the Cloud option was greyed out until a cloud environment existed. Creating one fixed it: New environment → Cloud → Add environment. After that the repository could be opened in a cloud session.

**What happened.** Claude read `CLAUDE.md` and this journal, checked the code for anything that would affect a deploy, and wrote a plan. It then walked through the deploy one step at a time, waiting for a "done" before giving the next step. The app built first time, in 31 seconds, and is live at a private `vercel.app` address behind the two passcodes.

**Steps.**
1. Turso: signed up with GitHub, created a database called `mastery-maths` in AWS US East, copied the `libsql://` URL and created a read and write token with no expiry. The app creates its own tables on first use, so there was nothing to set up inside the database.
2. Anthropic Console: added a small credit balance with auto-reload off, set a monthly spend limit, and created an API key named `mastery-maths`.
3. Chose a short student passcode, a long parent passcode, and a random session secret generated with `openssl rand -hex 32`.
4. Vercel: Add New → Project, imported the repository (Vercel's GitHub app was given access to this one repository only), kept the Next.js preset, and overrode the Install Command to `npm install --legacy-peer-deps`.
5. Added seven environment variables on the same screen before deploying: `STUDENT_PASSCODE`, `PARENT_PASSCODE`, `SESSION_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`.
6. Clicked Deploy.
7. Verified in a private browser window: the old development passcodes were rejected; the student login worked; the student could not open `/parent`; a deliberately wrong answer produced an AI explanation; and the parent dashboard showed that attempt afterwards. All five passed.

**What each piece is for.**
- Vercel runs the app but keeps no files between requests, so progress has to live in a hosted database. That is Turso's job.
- Environment variables hand secrets to the app without writing them in the code. The names must match exactly, because the code looks them up by name.
- The passcodes are the only lock on the site. The session secret is never typed by anyone: it signs the login cookie so a login cannot be forged. Changing it later logs everyone out.
- The Anthropic key is billed by usage, separately from a Claude subscription. If it is missing or out of credit the app still works and shows the built-in worked steps.
- Once the repository is connected, anything merged to `main` redeploys automatically.

**Lessons.**
- Secrets go from a private note straight into Vercel. They never go into the chat with Claude or into the repository.
- Set the environment variables before the first deploy. A build can succeed with them missing; the site only fails later, when someone tries to log in.
- A successful build proves the code compiled, nothing more. Each outside service needs its own check: a login for the passcodes, a saved attempt for the database, an explanation for the API key.
- Ask Claude to read the code for deploy problems before starting. It found two things the Vercel screens would not have flagged: the install command needed a flag, and the app would not complain about a missing session secret.
- A spend limit and a prepaid balance on the API account cap the cost if a key ever leaks.
- Going one step at a time, with a confirmation between each, meant nothing had to be undone.

## 2026-11-19 · 5. Grades become Levels on Amira's screens

**Why.** The home page listed Grade 3, Grade 4, Grade 5 and so on with a reward under each. A Grade 8 student could fairly read that as "I am being sent back to Grade 3" and switch off before starting. The work is the same; the label was the problem.

**What changed.** Everything Amira sees now says Level 1 to Level 6 in place of Grade 3 to Grade 8: the reward ladder, the "next up" line, the hours estimate, and the challenge start, pass and retake screens. The parent dashboard and the stored data still use real grades, because that is what matches the BC curriculum. One small file, `src/lib/level.ts`, holds the mapping, so it can be changed in one place.

**How it was checked.** Type check, the 131 tests, a production build, and a screenshot of the home page logged in as the student.

**Lesson.** Wording is a design decision. The same ladder motivates or deflates depending on what the rungs are called, and the person who knows the student is the one who spots it.

## 2026-11-19 · 6. A skill list for the teacher, and where things live

**What happened.** Asked where her interests, any learner settings, the teacher review and her current level should go. The answer was four different places, and only one of them is the app.

- Her interests go in the parent dashboard, in the settings box that themes the AI explanations.
- Learner settings are described to Claude in a session and built into the app. No personal or school records are stored in the repository.
- The teacher review runs the other way: the teacher needs something to review. Claude generated a list of the 43 skills by grade straight from the skill map in the code, with what each skill builds on, a blank column for notes, and four questions for the teacher. It was saved as a Google Doc in a private Drive folder, alongside a copy of this journal.
- Her current level is not entered anywhere. The first challenge finds it.

**Lessons.**
- Vercel runs the app and holds the secrets. It is not where content goes.
- Generate documents like the skill list from the code, so they cannot drift from what the app does.
- Keep one home for each thing. The repository holds the code and this journal; Drive holds copies for people who will never open GitHub. The Drive copy of the journal is refreshed when a new entry is added.

## 2026-11-19 · 7. Clearing test data before the first real session

**What happened.** The deploy checks in entry 4 included answering a question wrong on the live site. That answer landed inside the Level 1 challenge, which the app saves so it can be resumed. Left alone, Amira's first session would have opened part-way through a challenge she could no longer pass at 100%. The fix was to empty the progress tables in the Turso SQL console (`attempts`, `sessions`, `challenges`, `rewards`, `pending`, `skill_state`, `fact_state`), leaving `settings` alone.

**Lessons.**
- Testing on the live site writes to the real record. Either test with throwaway data you plan to clear, or clear it before the real user starts.
- In the Turso console, the Run button ran only the statement under the cursor. Each line has its own run arrow; check the tables afterwards to confirm they are empty.
- Never run those deletes once she has started. There is no undo.

## 2026-11-23 · 8. Learner settings

**What happened.** Asked for six adjustable supports in one update, starting in Plan mode so nothing changed until the plan was agreed. Claude read the code, asked two questions, wrote a plan, and built it after approval.

**What was built.**
1. Extra time. A parent setting, "Extra time on speed targets" (1.0 to 2.0, default 1.5), multiplies every speed target: the 3-second fact target and each skill's own target. Fact feedback now shows her time against her own recent best for that fact.
2. Breaks. A "Take a break" button on every question, a calm one-minute break screen she can leave early, and a single "Halfway. Want a 1-minute break?" offer mid-session. Breaks pause the session clock and are logged; the parent dashboard has a new table of recent sessions with the break count.
3. Chunked challenges. Challenges are split into blocks of up to 6 questions with a checkpoint between blocks. The checkpoint shows how many questions are done, not the score, and offers a break. The counter reads "Block 2 · question 3 of 6".
4. Worked example first. When a skill opens for practice, she first watches one solved problem, a step at a time, with a read-aloud button on each step. Then the first practice question is on that same skill.
5. Calculator on applied problems. Five skills (percents, circles, rates, Pythagoras) can show an on-screen calculator. Facts and arithmetic never do. The dashboard shows when it was used.
6. Reading level. The instructions given to the AI for explanations now ask for short common words and a quick definition of any maths term.

**Decisions made in the plan.**
- "Blocks of 6" would have left a 2-question final block on two levels, so blocks are balanced: 8 questions become 4 + 4, 14 become 5 + 5 + 4.
- When the break minute ends, the screen waits for her and does not jump back by itself.
- After a break on a fact question she gets a new fact, so fact times stay honest.
- The calculator never fills in the answer box.

**How it was checked.** 153 automated tests (131 before). New ones cover the time multiplier on mastery and fact fluency, the list of calculator skills, block boundaries, and the calculator's own arithmetic. Several drive the real engine against a throwaway database. Then a production build, and screenshots of each new screen from a local run.

**Lessons.**
- Start a large change in Plan mode. The plan surfaced two things worth deciding before any code existed: the awkward 2-question block, and what "extra time" should and should not touch.
- Be exact about what must not change. "Do not change the rushed threshold" and "never on arithmetic skills" each became a test, so a later change cannot quietly undo them.
- Changing a live database needs care. New columns are added only if missing, existing rows are never touched, and the upgrade was rehearsed on a copy shaped like the live one, with rows in it, before anything was pushed.
- Take screenshots from a scratch database, never the real one. Entry 7 is why.
- Looking at the screenshots found two things the tests did not: the first practice question could repeat the worked example, and the calculator had no bracket keys.
- Keep personal context out of the repository. Settings are described by what they do. The code, comments, commit messages and this journal say nothing about why.
