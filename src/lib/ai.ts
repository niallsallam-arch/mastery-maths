import Anthropic from "@anthropic-ai/sdk";

// The AI explains and summarises. It never marks answers and there is no open chat box,
// so it can't be used to get answers (the "cheat bot" problem the Alpha founder describes).
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const key = () => process.env.ANTHROPIC_API_KEY;
export const aiAvailable = () => !!key();

const TUTOR = `You write short explanations inside a maths practice app for a 13-year-old student who has dyslexia and finds it hard to hold long text in mind.
Rules:
- The correct answer is given to you and is always right. Never state or imply a different answer.
- Look at the student's wrong answer and name the most likely slip or misunderstanding in one short sentence, kindly. If it looks like a simple slip, say so.
- Then show the method in 2 to 4 very short numbered steps. One idea per line. Plain words. No more than 12 words per line.
- Use digits and symbols, not number words. No markdown headings, no bold, no emoji.
- Canadian spelling. Warm, calm and matter-of-fact. Never say "easy" or "just". No praise padding.
- If the student's interests are given, you may set one step in that context, only if it genuinely helps.
- Stay strictly on this maths problem. Do not ask questions back.`;

export async function explain(input: { prompt: string; answer: string; response: string; steps: string[]; interests: string }) {
  if (!key()) return null;
  const client = new Anthropic({ apiKey: key() });
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 300, system: TUTOR,
    messages: [{ role: "user", content: `Problem: ${input.prompt}\nCorrect answer: ${input.answer}\nStudent answered: ${input.response}\nReference method:\n${input.steps.join("\n")}\nStudent interests: ${input.interests || "not given"}` }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  // Guard: if the explanation doesn't contain the correct answer, don't show it.
  if (!text.replace(/\s/g, "").includes(input.answer.replace(/\s/g, ""))) return null;
  return text;
}

export async function parentSummary(data: unknown) {
  if (!key()) return null;
  const client = new Anthropic({ apiKey: key() });
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 700,
    system: `You summarise a week of maths practice data for a parent. Plain conversational English, Canadian spelling, no m-dashes, no superlatives, no headings. 3 short paragraphs: what she worked on and what moved; where the gaps and patterns are (speed, careless slips versus not knowing, rushing or skipped explanations); one or two concrete suggestions. Only state what the data shows; flag anything thin or ambiguous.`,
    messages: [{ role: "user", content: JSON.stringify(data) }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
