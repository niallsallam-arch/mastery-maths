import { Problem } from "./skills";
import { parseFrac, parseNumber, simplify, gcd } from "./math";

export interface CheckResult { correct: boolean; feedback?: string }

/** Marks an answer. Pure code: the AI is never asked whether an answer is right. */
export function check(p: Problem, raw: string): CheckResult {
  const r = raw.trim().replace(/\u2212/g, "-");
  if (!r) return { correct: false, feedback: "Type an answer first." };

  if (p.kind === "choice") return { correct: r === p.answer };

  if (p.kind === "remainder") {
    const m = r.match(/^(\d+)\s*r\s*(\d+)$/i);
    if (!m) return { correct: false, feedback: "Write it like 12 R 3." };
    return { correct: `${+m[1]} R ${+m[2]}` === p.answer };
  }

  if (p.kind === "fraction") {
    const got = parseFrac(r), want = parseFrac(p.answer);
    if (!got || !want) return { correct: false, feedback: "Write a fraction like 3/4, or a mixed number like 1 3/4." };
    const same = got.value.n * want.value.d === want.value.n * got.value.d;
    if (!same) return { correct: false };
    if (got.form === "decimal") return { correct: false, feedback: "Right amount. Now write it as a fraction, like 3/4." };
    if (p.form === "mixed" && got.form !== "mixed" && got.form !== "int") return { correct: false, feedback: "Right amount. Now write it as a mixed number, like 2 1/3." };
    if (p.form === "improper" && got.form !== "improper") return { correct: false, feedback: "Right amount. Now write it as an improper fraction, like 7/3." };
    if (p.form === "simplest") {
      const s = simplify(got.value);
      const isSimplest = got.form === "int" || (got.form === "mixed" ? isMixedSimplest(r) : gcd(got.value.n, got.value.d) === 1 && s.d !== 1);
      if (!isSimplest) return { correct: false, feedback: "Right amount, but it can be simplified more." };
    }
    return { correct: true };
  }

  const got = parseNumber(r), want = parseNumber(p.answer);
  if (got === null || want === null) return { correct: false, feedback: "Type a number." };
  return { correct: Math.abs(got - want) <= (p.tol ?? 1e-9) };
}

function isMixedSimplest(r: string) {
  const m = r.trim().match(/(\d+)\/(\d+)$/);
  return !!m && gcd(+m[1], +m[2]) === 1 && +m[1] < +m[2];
}
