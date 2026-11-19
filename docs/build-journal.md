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
