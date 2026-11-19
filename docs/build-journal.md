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

**What happened.** Asked where her interests, the IEP, the teacher review and her current level should go. The answer was four different places, and only one of them is the app.

- Her interests go in the parent dashboard, in the settings box that themes the AI explanations.
- The IEP goes nowhere as a document. The relevant accommodations are described to Claude in a session, and the app is checked against them. Nothing from it is stored in the repository.
- The teacher review runs the other way: the teacher needs something to review. Claude generated a list of the 43 skills by grade straight from the skill map in the code, with what each skill builds on, a blank column for notes, and four questions for the teacher. It was saved as a Google Doc in a private Drive folder, alongside a copy of this journal.
- Her current level is not entered anywhere. The first challenge finds it.

**Lessons.**
- Vercel runs the app and holds the secrets. It is not where content goes.
- Generate documents like the skill list from the code, so they cannot drift from what the app does.
- Keep one home for each thing. The repository holds the code and this journal; Drive holds copies for people who will never open GitHub. The Drive copy of the journal is refreshed when a new entry is added.
