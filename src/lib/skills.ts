// Skill map: BC Mathematics K–8 number, operations, fractions and algebra spine (Grades 3–8).
// Each skill lists its prerequisites so a gap can be traced back down the chain.
// Every problem's answer is computed in code. The AI only ever explains; it never marks.

import { Rng, ri, pick, gcd, lcm, fmt, Frac, fadd, fsub, fmul, fdiv, fracStr, mixedStr, simplify } from "./math";

export type AnswerKind = "number" | "fraction" | "choice" | "remainder";

export interface Visual { type: "fractionBar"; parts: number; shaded: number }

export interface Problem {
  prompt: string;            // shown on screen, kept short for reading load
  speak?: string;            // read-aloud version where symbols read badly
  answer: string;            // canonical answer, computed in code
  kind: AnswerKind;
  choices?: string[];
  tol?: number;              // numeric tolerance (e.g. answers using 3.14)
  form?: "simplest" | "mixed" | "improper"; // required fraction form
  unit?: string;             // shown beside the answer box
  steps: string[];           // worked solution, used when the AI is unavailable
  visual?: Visual;
}

export interface Skill {
  id: string;
  grade: number;
  strand: "Number" | "Operations" | "Fractions" | "Decimals & percents" | "Algebra" | "Geometry";
  title: string;
  prereqs: string[];
  fluencyMs?: number;        // answers slower than this don't count toward mastery
  calculatorOk?: boolean;    // applied problems only: the on-screen calculator may be offered
  gen: (rng: Rng, level: 1 | 2 | 3) => Problem;
}

const times = "×", div = "÷";
const cmp = (a: number, b: number) => (Math.abs(a - b) < 1e-9 ? "=" : a > b ? ">" : "<");
export const say = (s: string) => s.replace(/×/g, " times ").replace(/÷/g, " divided by ").replace(/−/g, " minus ").replace(/(\d)\/(\d)/g, "$1 over $2");
/** Read-aloud version of a worked step, where symbols read badly. */
export const sayStep = (s: string) => say(s).replace(/²/g, " squared").replace(/√/g, " the square root of ").replace(/π/g, " pi ").replace(/≈/g, " is about ").replace(/=/g, " equals ").replace(/☐/g, " box ").replace(/\s+/g, " ").trim();
const neg = (n: number) => (n < 0 ? `(−${Math.abs(n)})` : String(n));
const minus = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

function addSub(rng: Rng, digits: number, level: number): Problem {
  const lo = 10 ** (digits - 1), hi = 10 ** digits - 1;
  for (;;) {
    const a = ri(rng, lo, hi), b = ri(rng, lo, Math.min(hi, a));
    const sub = rng() < 0.5;
    const res = sub ? a - b : a + b;
    if (!sub && res > hi) continue;
    // count regroupings to match level
    let carries = 0;
    for (let p = 0, x = a, y = b, c = 0; p < digits; p++, x = Math.floor(x / 10), y = Math.floor(y / 10)) {
      const da = x % 10, db = y % 10;
      if (sub ? da - c < db : da + db + c > 9) { carries++; c = 1; } else c = 0;
    }
    if (level === 1 && carries !== 0) continue;
    if (level === 2 && carries !== 1) continue;
    if (level === 3 && carries < 2) continue;
    const op = sub ? "−" : "+";
    return {
      prompt: `${a} ${op} ${b}`, speak: `${a} ${sub ? "minus" : "plus"} ${b}`, answer: String(res), kind: "number",
      steps: [`Line the numbers up by place value.`, `Work right to left, ${sub ? "borrowing" : "carrying"} when you need to.`, `${a} ${op} ${b} = ${res}`],
    };
  }
}

export const SKILLS: Skill[] = [
  // ───────────── Grade 3
  {
    id: "g3.addsub20", grade: 3, strand: "Operations", title: "Add and subtract facts to 20", prereqs: [], fluencyMs: 5000,
    gen: (rng) => {
      const a = ri(rng, 3, 12), b = ri(rng, 2, 9);
      if (rng() < 0.5) return { prompt: `${a} + ${b}`, speak: `${a} plus ${b}`, answer: String(a + b), kind: "number", steps: [`Make a ten: ${a} + ${b} = ${a + b}`] };
      const s = a + b;
      return { prompt: `${s} − ${b}`, speak: `${s} minus ${b}`, answer: String(a), kind: "number", steps: [`Think addition: ${b} + ? = ${s}. The answer is ${a}.`] };
    },
  },
  {
    id: "g3.addsub1000", grade: 3, strand: "Operations", title: "Add and subtract within 1,000", prereqs: ["g3.addsub20"],
    gen: (rng, l) => addSub(rng, 3, l),
  },
  {
    id: "g3.mulconcept", grade: 3, strand: "Operations", title: "Multiplication and division as equal groups", prereqs: ["g3.addsub20"],
    gen: (rng, l) => {
      const g = ri(rng, 2, 5), e = ri(rng, 2, l === 1 ? 5 : 6);
      if (l < 3 || rng() < 0.5) return { prompt: `There are ${g} bags with ${e} marbles in each bag. How many marbles altogether?`, answer: String(g * e), kind: "number", steps: [`${g} equal groups of ${e} is ${g} ${times} ${e}.`, `${g} ${times} ${e} = ${g * e}`] };
      return { prompt: `${g * e} stickers are shared equally between ${g} friends. How many does each friend get?`, answer: String(e), kind: "number", steps: [`Sharing equally is division: ${g * e} ${div} ${g}.`, `${g} ${times} ${e} = ${g * e}, so each gets ${e}.`] };
    },
  },
  {
    id: "g3.fraccon", grade: 3, strand: "Fractions", title: "Fraction concepts (part of a whole)", prereqs: [],
    gen: (rng) => {
      const d = pick(rng, [2, 3, 4, 5, 6, 8] as const), n = ri(rng, 1, d - 1);
      return { prompt: `What fraction of the bar is shaded?`, answer: `${n}/${d}`, kind: "fraction", visual: { type: "fractionBar", parts: d, shaded: n }, steps: [`The bar has ${d} equal parts. That is the bottom number.`, `${n} parts are shaded. That is the top number.`, `So the fraction is ${n}/${d}.`] };
    },
  },
  // ───────────── Grade 4
  {
    id: "g4.mulfacts", grade: 4, strand: "Operations", title: "Multiplication facts to 10 × 10", prereqs: ["g3.mulconcept"], fluencyMs: 6000,
    gen: (rng) => { const a = ri(rng, 2, 10), b = ri(rng, 2, 10); return { prompt: `${a} ${times} ${b}`, speak: say(`${a} × ${b}`), answer: String(a * b), kind: "number", steps: [`${a} groups of ${b} is ${a * b}.`] }; },
  },
  {
    id: "g4.divfacts", grade: 4, strand: "Operations", title: "Division facts to 100", prereqs: ["g4.mulfacts"], fluencyMs: 6000,
    gen: (rng) => { const a = ri(rng, 2, 10), b = ri(rng, 2, 10); return { prompt: `${a * b} ${div} ${a}`, speak: say(`${a * b} ÷ ${a}`), answer: String(b), kind: "number", steps: [`Think: ${a} ${times} ? = ${a * b}.`, `${a} ${times} ${b} = ${a * b}, so the answer is ${b}.`] }; },
  },
  {
    id: "g4.addsub10000", grade: 4, strand: "Operations", title: "Add and subtract within 10,000", prereqs: ["g3.addsub1000"],
    gen: (rng, l) => addSub(rng, 4, l),
  },
  {
    id: "g4.mul1digit", grade: 4, strand: "Operations", title: "Multiply 2- and 3-digit numbers by 1 digit", prereqs: ["g4.mulfacts", "g3.addsub1000"],
    gen: (rng, l) => {
      const a = l === 1 ? ri(rng, 12, 49) : ri(rng, 112, 899), b = ri(rng, 3, 9);
      const t = Math.floor(a / 10) * 10, o = a % 10;
      return { prompt: `${a} ${times} ${b}`, speak: say(`${a} × ${b}`), answer: String(a * b), kind: "number", steps: [`Split ${a} into ${t} + ${o}.`, `${t} ${times} ${b} = ${t * b} and ${o} ${times} ${b} = ${o * b}.`, `${t * b} + ${o * b} = ${a * b}`] };
    },
  },
  {
    id: "g4.div1digit", grade: 4, strand: "Operations", title: "Divide 2- and 3-digit numbers by 1 digit", prereqs: ["g4.divfacts", "g4.mul1digit"],
    gen: (rng, l) => {
      const b = ri(rng, 2, 9), q = l === 1 ? ri(rng, 11, 30) : ri(rng, 21, 99);
      return { prompt: `${b * q} ${div} ${b}`, speak: say(`${b * q} ÷ ${b}`), answer: String(q), kind: "number", steps: [`Ask: how many ${b}s fit into ${b * q}?`, `Check by multiplying: ${q} ${times} ${b} = ${b * q}.`, `So the answer is ${q}.`] };
    },
  },
  {
    id: "g4.decimals", grade: 4, strand: "Decimals & percents", title: "Decimals to hundredths", prereqs: ["g3.fraccon"],
    gen: (rng, l) => {
      if (l === 1) { const n = ri(rng, 1, 9); return { prompt: `Write ${n}/10 as a decimal.`, speak: `Write ${n} tenths as a decimal.`, answer: `0.${n}`, kind: "number", steps: [`Tenths go in the first place after the decimal point.`, `${n}/10 = 0.${n}`] }; }
      if (l === 2) { const n = ri(rng, 11, 99); return { prompt: `Write ${n}/100 as a decimal.`, speak: `Write ${n} hundredths as a decimal.`, answer: fmt(n / 100), kind: "number", steps: [`Hundredths use two places after the decimal point.`, `${n}/100 = ${fmt(n / 100)}`] }; }
      const a = ri(rng, 1, 9) / 10, b = ri(rng, 11, 99) / 100;
      const [x, y] = rng() < 0.5 ? [a, b] : [b, a];
      return { prompt: `Which sign goes in the box?  ${fmt(x)} ☐ ${fmt(y)}`, speak: `Is ${fmt(x)} greater than, less than, or equal to ${fmt(y)}?`, answer: cmp(x, y), kind: "choice", choices: ["<", "=", ">"], steps: [`Give both the same number of places: ${x.toFixed(2)} and ${y.toFixed(2)}.`, `Now compare them like whole numbers: ${Math.round(x * 100)} and ${Math.round(y * 100)}.`, `So ${fmt(x)} ${cmp(x, y)} ${fmt(y)}.`] };
    },
  },
  {
    id: "g4.fraccompare", grade: 4, strand: "Fractions", title: "Compare fractions with the same top or bottom", prereqs: ["g3.fraccon"],
    gen: (rng) => {
      const same = rng() < 0.5 ? "d" : "n";
      let a: Frac, b: Frac;
      if (same === "d") { const d = ri(rng, 3, 12); a = { n: ri(rng, 1, d - 1), d }; b = { n: ri(rng, 1, d - 1), d }; }
      else { const n = ri(rng, 1, 5); a = { n, d: ri(rng, n + 1, 12) }; b = { n, d: ri(rng, n + 1, 12) }; }
      const c = cmp(a.n / a.d, b.n / b.d);
      return { prompt: `Which sign goes in the box?  ${a.n}/${a.d} ☐ ${b.n}/${b.d}`, speak: `Compare ${a.n} over ${a.d} and ${b.n} over ${b.d}.`, answer: c, kind: "choice", choices: ["<", "=", ">"], steps: same === "d" ? [`Same bottom number means same-sized pieces.`, `More pieces is bigger, so compare the tops.`, `${a.n}/${a.d} ${c} ${b.n}/${b.d}`] : [`Same top number means the same count of pieces.`, `A bigger bottom number means smaller pieces.`, `${a.n}/${a.d} ${c} ${b.n}/${b.d}`] };
    },
  },
  {
    id: "g4.onestep", grade: 4, strand: "Algebra", title: "One-step equations with an unknown (☐)", prereqs: ["g4.divfacts", "g3.addsub1000"],
    gen: (rng) => {
      const x = ri(rng, 2, 12), b = ri(rng, 2, 12);
      const t = ri(rng, 0, 3);
      const forms = [
        { p: `☐ + ${b} = ${x + b}`, s: [`Undo adding ${b}: ${x + b} − ${b} = ${x}.`] },
        { p: `☐ − ${b} = ${x}`, a: x + b, s: [`Undo subtracting ${b}: ${x} + ${b} = ${x + b}.`] },
        { p: `☐ ${times} ${b} = ${x * b}`, s: [`Undo multiplying: ${x * b} ${div} ${b} = ${x}.`] },
        { p: `${x * b} ${div} ☐ = ${b}`, s: [`Think: ${b} ${times} ? = ${x * b}. It is ${x}.`] },
      ][t];
      const ans = "a" in forms && forms.a !== undefined ? forms.a : x;
      return { prompt: `What number goes in the box?  ${forms.p}`, speak: say(`What number goes in the box? ${forms.p.replace("☐", "box")}`), answer: String(ans), kind: "number", steps: forms.s };
    },
  },
  // ───────────── Grade 5
  {
    id: "g5.decaddsub", grade: 5, strand: "Decimals & percents", title: "Add and subtract decimals to thousandths", prereqs: ["g4.decimals", "g4.addsub10000"],
    gen: (rng, l) => {
      const pa = l === 1 ? 1 : l === 2 ? 2 : 3, pb = ri(rng, 1, pa);
      const a = ri(rng, 10 ** pa, 9 * 10 ** pa) / 10 ** pa, b = ri(rng, 10 ** pb, 9 * 10 ** pb) / 10 ** pb;
      const sub = rng() < 0.5 && a > b;
      const r = sub ? a - b : a + b;
      return { prompt: `${fmt(a)} ${sub ? "−" : "+"} ${fmt(b)}`, speak: `${fmt(a)} ${sub ? "minus" : "plus"} ${fmt(b)}`, answer: fmt(r), kind: "number", steps: [`Line up the decimal points.`, `Fill empty places with zeros: ${a.toFixed(pa)} and ${b.toFixed(pa)}.`, `${sub ? "Subtract" : "Add"} like whole numbers, keeping the point in place: ${fmt(r)}.`] };
    },
  },
  {
    id: "g5.mul2x2", grade: 5, strand: "Operations", title: "Multiply 2-digit by 2-digit", prereqs: ["g4.mul1digit"],
    gen: (rng) => {
      const a = ri(rng, 12, 99), b = ri(rng, 12, 99), bt = Math.floor(b / 10) * 10, bo = b % 10;
      return { prompt: `${a} ${times} ${b}`, speak: say(`${a} × ${b}`), answer: String(a * b), kind: "number", steps: [`Split ${b} into ${bt} + ${bo}.`, `${a} ${times} ${bt} = ${a * bt}`, `${a} ${times} ${bo} = ${a * bo}`, `${a * bt} + ${a * bo} = ${a * b}`] };
    },
  },
  {
    id: "g5.divrem", grade: 5, strand: "Operations", title: "Divide 3-digit by 1-digit, with remainders", prereqs: ["g4.div1digit"],
    gen: (rng) => {
      for (;;) {
        const b = ri(rng, 3, 9), n = ri(rng, 100, 999), q = Math.floor(n / b), r = n % b;
        if (!r) continue;
        return { prompt: `${n} ${div} ${b}  (write it like 12 R 3)`, speak: `${n} divided by ${b}. Give the answer and the remainder.`, answer: `${q} R ${r}`, kind: "remainder", steps: [`${b} goes into ${n} a total of ${q} times: ${q} ${times} ${b} = ${q * b}.`, `What's left over: ${n} − ${q * b} = ${r}.`, `Answer: ${q} R ${r}`] };
      }
    },
  },
  {
    id: "g5.equivfrac", grade: 5, strand: "Fractions", title: "Equivalent fractions", prereqs: ["g4.mulfacts", "g4.fraccompare"],
    gen: (rng, l) => {
      const d = ri(rng, 2, 9), n = ri(rng, 1, d - 1), k = ri(rng, 2, l === 1 ? 4 : 8);
      const s = simplify({ n, d });
      if (l === 3) return { prompt: `Write ${s.n * k}/${s.d * k} in simplest form.`, speak: `Write ${s.n * k} over ${s.d * k} in simplest form.`, answer: fracStr(s), kind: "fraction", form: "simplest", steps: [`Find a number that divides both ${s.n * k} and ${s.d * k}: ${k}.`, `${s.n * k} ${div} ${k} = ${s.n}, ${s.d * k} ${div} ${k} = ${s.d}.`, `Simplest form: ${fracStr(s)}`] };
      return { prompt: `Fill in the missing number:  ${n}/${d} = ?/${d * k}`, speak: `${n} over ${d} equals what over ${d * k}?`, answer: String(n * k), kind: "number", steps: [`The bottom went from ${d} to ${d * k}. That is ${times} ${k}.`, `Do the same to the top: ${n} ${times} ${k} = ${n * k}.`] };
    },
  },
  {
    id: "g5.fraccompare", grade: 5, strand: "Fractions", title: "Compare fractions with different bottoms", prereqs: ["g5.equivfrac"],
    gen: (rng) => {
      for (;;) {
        const d1 = ri(rng, 2, 9), d2 = ri(rng, 2, 9);
        if (d1 === d2) continue;
        const a = { n: ri(rng, 1, d1 - 1), d: d1 }, b = { n: ri(rng, 1, d2 - 1), d: d2 };
        const L = lcm(d1, d2), c = cmp(a.n / a.d, b.n / b.d);
        return { prompt: `Which sign goes in the box?  ${a.n}/${a.d} ☐ ${b.n}/${b.d}`, speak: `Compare ${a.n} over ${a.d} and ${b.n} over ${b.d}.`, answer: c, kind: "choice", choices: ["<", "=", ">"], steps: [`Give them the same bottom number, ${L}.`, `${a.n}/${a.d} = ${(a.n * L) / a.d}/${L} and ${b.n}/${b.d} = ${(b.n * L) / b.d}/${L}.`, `Compare the tops: ${a.n}/${a.d} ${c} ${b.n}/${b.d}.`] };
      }
    },
  },
  {
    id: "g5.onestepvar", grade: 5, strand: "Algebra", title: "One-step equations with a variable", prereqs: ["g4.onestep"],
    gen: (rng) => {
      const n = ri(rng, 3, 40), b = ri(rng, 3, 25), k = ri(rng, 2, 9);
      const t = ri(rng, 0, 2);
      const v = pick(rng, ["n", "x", "y", "a"] as const);
      if (t === 0) return { prompt: `${v} + ${b} = ${n + b}.  What is ${v}?`, answer: String(n), kind: "number", steps: [`Subtract ${b} from both sides.`, `${v} = ${n + b} − ${b} = ${n}`] };
      if (t === 1) return { prompt: `${v} − ${b} = ${n}.  What is ${v}?`, speak: `${v} minus ${b} equals ${n}. What is ${v}?`, answer: String(n + b), kind: "number", steps: [`Add ${b} to both sides.`, `${v} = ${n} + ${b} = ${n + b}`] };
      const m = ri(rng, 2, 12);
      return { prompt: `${k} ${times} ${v} = ${k * m}.  What is ${v}?`, speak: `${k} times ${v} equals ${k * m}. What is ${v}?`, answer: String(m), kind: "number", steps: [`Divide both sides by ${k}.`, `${v} = ${k * m} ${div} ${k} = ${m}`] };
    },
  },
  // ───────────── Grade 6
  {
    id: "g6.facts12", grade: 6, strand: "Operations", title: "Multiplication and division facts to 12 × 12 (fluency)", prereqs: ["g4.divfacts"], fluencyMs: 4000,
    gen: (rng) => {
      const a = ri(rng, 3, 12), b = ri(rng, 3, 12);
      return rng() < 0.6 ? { prompt: `${a} ${times} ${b}`, speak: say(`${a} × ${b}`), answer: String(a * b), kind: "number", steps: [`${a} ${times} ${b} = ${a * b}`] } : { prompt: `${a * b} ${div} ${b}`, speak: say(`${a * b} ÷ ${b}`), answer: String(a), kind: "number", steps: [`${b} ${times} ${a} = ${a * b}, so ${a * b} ${div} ${b} = ${a}`] };
    },
  },
  {
    id: "g6.gcf", grade: 6, strand: "Number", title: "Greatest common factor", prereqs: ["g6.facts12"],
    gen: (rng) => {
      const g = ri(rng, 2, 12); let x = ri(rng, 2, 9), y = ri(rng, 2, 9);
      while (gcd(x, y) !== 1 || x === y) { x = ri(rng, 2, 9); y = ri(rng, 2, 9); }
      return { prompt: `What is the greatest common factor of ${g * x} and ${g * y}?`, answer: String(g), kind: "number", steps: [`List factors, or look for the biggest number that divides both.`, `${g * x} = ${g} ${times} ${x} and ${g * y} = ${g} ${times} ${y}.`, `${x} and ${y} share no other factor, so the GCF is ${g}.`] };
    },
  },
  {
    id: "g6.lcm", grade: 6, strand: "Number", title: "Least common multiple", prereqs: ["g6.facts12"],
    gen: (rng) => {
      const a = ri(rng, 2, 12); let b = ri(rng, 2, 12); while (a === b) b = ri(rng, 2, 12);
      const L = lcm(a, b);
      return { prompt: `What is the least common multiple of ${a} and ${b}?`, answer: String(L), kind: "number", steps: [`Count up in ${Math.max(a, b)}s until you hit a number ${Math.min(a, b)} also goes into.`, `The first one is ${L}.`] };
    },
  },
  {
    id: "g6.mixed", grade: 6, strand: "Fractions", title: "Improper fractions and mixed numbers", prereqs: ["g5.divrem", "g5.equivfrac"],
    gen: (rng, l) => {
      const d = ri(rng, 2, 9), w = ri(rng, 1, 6), r = ri(rng, 1, d - 1);
      const s = simplify({ n: r, d }); const dd = s.d, rr = s.n;
      const imp = { n: w * dd + rr, d: dd };
      if (l !== 3) return { prompt: `Write ${imp.n}/${imp.d} as a mixed number.`, speak: `Write ${imp.n} over ${imp.d} as a mixed number.`, answer: mixedStr(imp), kind: "fraction", form: "mixed", steps: [`${imp.n} ${div} ${imp.d} = ${w} remainder ${rr}.`, `${w} wholes, with ${rr} out of ${imp.d} left over.`, `${mixedStr(imp)} (type it like 2 3/4)`] };
      return { prompt: `Write ${w} ${rr}/${dd} as an improper fraction.`, speak: `Write ${w} and ${rr} over ${dd} as an improper fraction.`, answer: `${imp.n}/${imp.d}`, kind: "fraction", form: "improper", steps: [`Wholes into pieces: ${w} ${times} ${dd} = ${w * dd}.`, `Add the extra ${rr}: ${w * dd} + ${rr} = ${imp.n}.`, `${imp.n}/${imp.d}`] };
    },
  },
  {
    id: "g6.orderops", grade: 6, strand: "Operations", title: "Order of operations", prereqs: ["g5.mul2x2", "g4.div1digit"],
    gen: (rng, l) => {
      const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
      if (l === 1) return { prompt: `${a} + ${b} ${times} ${c}`, speak: say(`${a} + ${b} × ${c}`), answer: String(a + b * c), kind: "number", steps: [`Multiply before adding: ${b} ${times} ${c} = ${b * c}.`, `${a} + ${b * c} = ${a + b * c}`] };
      if (l === 2) { const x = a + b + c; return { prompt: `(${x} − ${b}) ${times} ${c} + ${a}`, speak: `Open bracket ${x} minus ${b} close bracket, times ${c}, plus ${a}`, answer: String((x - b) * c + a), kind: "number", steps: [`Brackets first: ${x} − ${b} = ${x - b}.`, `Then multiply: ${x - b} ${times} ${c} = ${(x - b) * c}.`, `Then add: ${(x - b) * c} + ${a} = ${(x - b) * c + a}`] }; }
      const p = b * c, big = p * ri(rng, 1, 3) + a * 10;
      return { prompt: `${big} − ${p} ${div} ${b} ${times} ${a}`, speak: say(`${big} − ${p} ÷ ${b} × ${a}`), answer: String(big - (p / b) * a), kind: "number", steps: [`Divide and multiply left to right first: ${p} ${div} ${b} = ${c}, then ${c} ${times} ${a} = ${c * a}.`, `Then subtract: ${big} − ${c * a} = ${big - c * a}`] };
    },
  },
  {
    id: "g6.decmuldiv", grade: 6, strand: "Decimals & percents", title: "Multiply and divide decimals by whole numbers", prereqs: ["g5.decaddsub", "g4.mul1digit"],
    gen: (rng) => {
      const k = ri(rng, 2, 9), a = ri(rng, 11, 99) / 10;
      if (rng() < 0.5) return { prompt: `${fmt(a)} ${times} ${k}`, speak: say(`${fmt(a)} × ${k}`), answer: fmt(a * k), kind: "number", steps: [`Ignore the point: ${Math.round(a * 10)} ${times} ${k} = ${Math.round(a * 10) * k}.`, `There was 1 decimal place, so put 1 back: ${fmt(a * k)}.`] };
      const q = ri(rng, 11, 99) / 10;
      return { prompt: `${fmt(q * k)} ${div} ${k}`, speak: say(`${fmt(q * k)} ÷ ${k}`), answer: fmt(q), kind: "number", steps: [`Divide like whole numbers: ${Math.round(q * k * 10)} ${div} ${k} = ${Math.round(q * 10)}.`, `Keep 1 decimal place: ${fmt(q)}.`] };
    },
  },
  {
    id: "g6.percent", grade: 6, strand: "Decimals & percents", title: "Whole-number percents and discounts", prereqs: ["g4.decimals", "g6.facts12"], calculatorOk: true,
    gen: (rng, l) => {
      const p = pick(rng, [10, 20, 25, 50, 75, 30, 40] as const), base = pick(rng, [20, 40, 60, 80, 100, 120, 200] as const);
      const part = (p * base) / 100;
      if (l === 1) return { prompt: `What is ${p}% of ${base}?`, speak: `What is ${p} percent of ${base}?`, answer: fmt(part), kind: "number", steps: [`${p}% means ${p} out of 100.`, `${base} ${times} ${p} ${div} 100 = ${fmt(part)}`] };
      if (l === 2) return { prompt: `A $${base} jacket is ${p}% off. What is the sale price?`, speak: `A ${base} dollar jacket is ${p} percent off. What is the sale price?`, answer: fmt(base - part), kind: "number", unit: "$", steps: [`Discount: ${p}% of ${base} = ${fmt(part)}.`, `Sale price: ${base} − ${fmt(part)} = ${fmt(base - part)}.`] };
      return { prompt: `What percent of ${base} is ${fmt(part)}?`, answer: String(p), kind: "number", unit: "%", steps: [`Make a fraction: ${fmt(part)}/${base}.`, `Turn it into hundredths: ${fmt(part)} ${div} ${base} = ${fmt(part / base)} = ${p}%.`] };
    },
  },
  {
    id: "g6.ratio", grade: 6, strand: "Fractions", title: "Introduction to ratios", prereqs: ["g5.equivfrac"],
    gen: (rng) => {
      const a = ri(rng, 1, 7), b = ri(rng, 2, 9), k = ri(rng, 2, 6);
      return { prompt: `Fill in the missing number:  ${a} : ${b} = ${a * k} : ?`, speak: `${a} to ${b} is the same as ${a * k} to what?`, answer: String(b * k), kind: "number", steps: [`${a} became ${a * k}. That is ${times} ${k}.`, `Do the same to the other side: ${b} ${times} ${k} = ${b * k}.`] };
    },
  },
  {
    id: "g6.onestepcoef", grade: 6, strand: "Algebra", title: "One-step equations with coefficients", prereqs: ["g5.onestepvar", "g6.facts12"],
    gen: (rng) => {
      const x = ri(rng, 2, 15), k = ri(rng, 2, 12);
      if (rng() < 0.6) return { prompt: `${k}x = ${k * x}.  What is x?`, speak: `${k} x equals ${k * x}. What is x?`, answer: String(x), kind: "number", steps: [`${k}x means ${k} ${times} x.`, `Divide both sides by ${k}: x = ${k * x} ${div} ${k} = ${x}.`] };
      return { prompt: `x ${div} ${k} = ${x}.  What is x?`, speak: `x divided by ${k} equals ${x}. What is x?`, answer: String(x * k), kind: "number", steps: [`Multiply both sides by ${k}.`, `x = ${x} ${times} ${k} = ${x * k}`] };
    },
  },
  // ───────────── Grade 7
  {
    id: "g7.intadd", grade: 7, strand: "Number", title: "Add and subtract integers", prereqs: ["g4.addsub10000"],
    gen: (rng) => {
      const a = ri(rng, -15, 15), b = ri(rng, -15, 15) || 3;
      const sub = rng() < 0.5;
      const r = sub ? a - b : a + b;
      return { prompt: `${minus(a)} ${sub ? "−" : "+"} ${neg(b)}`, speak: `${a < 0 ? "negative " + -a : a} ${sub ? "minus" : "plus"} ${b < 0 ? "negative " + -b : b}`, answer: String(r), kind: "number", steps: sub ? [`Subtracting a number is adding its opposite.`, `${minus(a)} − ${neg(b)} = ${minus(a)} + ${neg(-b)}`, `= ${minus(r)}`] : [`Start at ${minus(a)} on a number line.`, `${b >= 0 ? `Move ${b} right` : `Move ${-b} left`}.`, `You land on ${minus(r)}.`] };
    },
  },
  {
    id: "g7.intmul", grade: 7, strand: "Number", title: "Multiply and divide integers", prereqs: ["g7.intadd", "g6.facts12"],
    gen: (rng) => {
      const a = ri(rng, 2, 12) * pick(rng, [1, -1] as const), b = ri(rng, 2, 12) * pick(rng, [1, -1] as const);
      const rule = `Same signs give a positive answer. Different signs give a negative answer.`;
      if (rng() < 0.5) return { prompt: `${minus(a)} ${times} ${neg(b)}`, speak: say(`${a} × ${b}`).replace(/-/g, "negative "), answer: String(a * b), kind: "number", steps: [rule, `${Math.abs(a)} ${times} ${Math.abs(b)} = ${Math.abs(a * b)}, so the answer is ${minus(a * b)}.`] };
      return { prompt: `${minus(a * b)} ${div} ${neg(a)}`, speak: say(`${a * b} ÷ ${a}`).replace(/-/g, "negative "), answer: String(b), kind: "number", steps: [rule, `${Math.abs(a * b)} ${div} ${Math.abs(a)} = ${Math.abs(b)}, so the answer is ${minus(b)}.`] };
    },
  },
  {
    id: "g7.decops", grade: 7, strand: "Decimals & percents", title: "Multiply and divide decimals", prereqs: ["g6.decmuldiv"],
    gen: (rng) => {
      const a = ri(rng, 2, 9) / 10 * pick(rng, [1, 10] as const), b = ri(rng, 2, 9) / 10;
      const pa = a < 1 ? 1 : 0, ia = Math.round(a * 10 ** pa), ib = Math.round(b * 10);
      if (rng() < 0.5) return { prompt: `${fmt(a)} ${times} ${fmt(b)}`, speak: say(`${fmt(a)} × ${fmt(b)}`), answer: fmt(a * b), kind: "number", steps: [`Multiply without the points: ${ia} ${times} ${ib} = ${ia * ib}.`, `The question has ${pa + 1} decimal place${pa ? "s" : ""} in total, so put ${pa + 1} back: ${fmt(a * b)}.`] };
      const q = ri(rng, 2, 19);
      return { prompt: `${fmt(q * b)} ${div} ${fmt(b)}`, speak: say(`${fmt(q * b)} ÷ ${fmt(b)}`), answer: String(q), kind: "number", steps: [`Move both points one place right: ${fmt(q * b * 10)} ${div} ${fmt(b * 10)}.`, `${fmt(q * b * 10)} ${div} ${fmt(b * 10)} = ${q}`] };
    },
  },
  {
    id: "g7.fdp", grade: 7, strand: "Decimals & percents", title: "Fractions, decimals and percents", prereqs: ["g6.percent", "g5.equivfrac"],
    gen: (rng, l) => {
      const f = pick(rng, [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [1, 20], [3, 20], [1, 25], [1, 8], [3, 8]] as const);
      const val = f[0] / f[1];
      if (l === 1) return { prompt: `Write ${f[0]}/${f[1]} as a percent.`, speak: `Write ${f[0]} over ${f[1]} as a percent.`, answer: fmt(val * 100), kind: "number", unit: "%", steps: [`Divide: ${f[0]} ${div} ${f[1]} = ${fmt(val)}.`, `${times} 100 to get a percent: ${fmt(val * 100)}%.`] };
      if (l === 2) return { prompt: `Write ${fmt(val * 100)}% as a decimal.`, speak: `Write ${fmt(val * 100)} percent as a decimal.`, answer: fmt(val), kind: "number", steps: [`Percent means out of 100, so ${div} 100.`, `${fmt(val * 100)} ${div} 100 = ${fmt(val)}`] };
      return { prompt: `Write ${fmt(val)} as a fraction in simplest form.`, answer: `${f[0]}/${f[1]}`, kind: "fraction", form: "simplest", steps: [`${fmt(val)} = ${Math.round(val * 1000)}/1000.`, `Simplify: ${f[0]}/${f[1]}.`] };
    },
  },
  {
    id: "g7.evalexpr", grade: 7, strand: "Algebra", title: "Evaluate expressions", prereqs: ["g6.orderops", "g7.intadd"],
    gen: (rng, l) => {
      const k = ri(rng, 2, 9), c = ri(rng, 1, 15), x = l === 3 ? ri(rng, -6, 9) : ri(rng, 1, 9);
      if (l < 3) return { prompt: `Find ${k}x + ${c} when x = ${x}.`, speak: `Find ${k} x plus ${c} when x equals ${x}.`, answer: String(k * x + c), kind: "number", steps: [`Swap x for ${x}: ${k} ${times} ${x} + ${c}.`, `${k * x} + ${c} = ${k * x + c}`] };
      const b = ri(rng, 1, 9);
      return { prompt: `Find 2a − b when a = ${x} and b = ${b}.`, speak: `Find 2 a minus b when a equals ${x} and b equals ${b}.`, answer: String(2 * x - b), kind: "number", steps: [`Swap in the values: 2 ${times} ${neg(x)} − ${b}.`, `${2 * x} − ${b} = ${2 * x - b}`] };
    },
  },
  {
    id: "g7.twostep", grade: 7, strand: "Algebra", title: "Two-step equations (whole numbers)", prereqs: ["g6.onestepcoef", "g6.orderops"],
    gen: (rng) => {
      const x = ri(rng, 1, 12), k = ri(rng, 2, 9), c = ri(rng, 1, 20);
      if (rng() < 0.6) return { prompt: `${k}x + ${c} = ${k * x + c}.  What is x?`, speak: `${k} x plus ${c} equals ${k * x + c}. What is x?`, answer: String(x), kind: "number", steps: [`Undo the + ${c} first: ${k}x = ${k * x + c} − ${c} = ${k * x}.`, `Then undo the ${times} ${k}: x = ${k * x} ${div} ${k} = ${x}.`] };
      const y = x + 2;
      return { prompt: `${k}x − ${c} = ${k * y - c}.  What is x?`, speak: `${k} x minus ${c} equals ${k * y - c}. What is x?`, answer: String(y), kind: "number", steps: [`Undo the − ${c} first: ${k}x = ${k * y - c} + ${c} = ${k * y}.`, `Then divide by ${k}: x = ${y}.`] };
    },
  },
  {
    id: "g7.circle", grade: 7, strand: "Geometry", title: "Circumference and area of circles", prereqs: ["g7.decops"], calculatorOk: true,
    gen: (rng, l) => {
      const r = ri(rng, 2, 10);
      if (l < 3) return { prompt: `A circle has a radius of ${r} cm. What is its circumference? Use π = 3.14.`, speak: `A circle has a radius of ${r} centimetres. What is its circumference? Use pi equals 3.14.`, answer: fmt(2 * 3.14 * r), kind: "number", tol: 0.05, unit: "cm", steps: [`Circumference = 2 ${times} π ${times} r.`, `2 ${times} 3.14 ${times} ${r} = ${fmt(2 * 3.14 * r)} cm`] };
      return { prompt: `A circle has a radius of ${r} cm. What is its area? Use π = 3.14.`, speak: `A circle has a radius of ${r} centimetres. What is its area? Use pi equals 3.14.`, answer: fmt(3.14 * r * r), kind: "number", tol: 0.05, unit: "cm²", steps: [`Area = π ${times} r ${times} r.`, `3.14 ${times} ${r} ${times} ${r} = ${fmt(3.14 * r * r)} cm²`] };
    },
  },
  // ───────────── Grade 8
  {
    id: "g8.squares", grade: 8, strand: "Number", title: "Perfect squares, cubes and roots", prereqs: ["g6.facts12"],
    gen: (rng, l) => {
      const n = ri(rng, 2, 15);
      if (l === 1) return { prompt: `What is ${n}²?`, speak: `What is ${n} squared?`, answer: String(n * n), kind: "number", steps: [`${n}² means ${n} ${times} ${n} = ${n * n}.`] };
      if (l === 2) return { prompt: `What is √${n * n}?`, speak: `What is the square root of ${n * n}?`, answer: String(n), kind: "number", steps: [`Which number times itself makes ${n * n}?`, `${n} ${times} ${n} = ${n * n}, so √${n * n} = ${n}.`] };
      const m = ri(rng, 2, 5);
      return { prompt: `What is ${m}³?`, speak: `What is ${m} cubed?`, answer: String(m ** 3), kind: "number", steps: [`${m}³ means ${m} ${times} ${m} ${times} ${m}.`, `${m * m} ${times} ${m} = ${m ** 3}`] };
    },
  },
  {
    id: "g8.fracadd", grade: 8, strand: "Fractions", title: "Add and subtract fractions", prereqs: ["g6.lcm", "g6.mixed"],
    gen: (rng, l) => {
      for (;;) {
        const d1 = ri(rng, 2, 8), d2 = ri(rng, 2, 10);
        if (l > 1 && d1 === d2) continue;
        const a = { n: ri(rng, 1, d1 - 1) + (l === 3 ? d1 * ri(rng, 1, 3) : 0), d: d1 }, b = { n: ri(rng, 1, d2 - 1), d: d2 };
        const sub = rng() < 0.5 && a.n / a.d > b.n / b.d;
        const r = sub ? fsub(a, b) : fadd(a, b), L = lcm(d1, d2);
        const show = (f: Frac) => (l === 3 && f === a ? mixedStr(f) : `${f.n}/${f.d}`);
        return { prompt: `${show(a)} ${sub ? "−" : "+"} ${show(b)}  (simplest form)`, speak: say(`${show(a)} ${sub ? "−" : "plus"} ${show(b)}, in simplest form`), answer: l === 3 ? mixedStr(r) : fracStr(r), kind: "fraction", form: "simplest", steps: [`Common bottom number: ${L}.`, `${a.n}/${a.d} = ${(a.n * L) / a.d}/${L} and ${b.n}/${b.d} = ${(b.n * L) / b.d}/${L}.`, `${sub ? "Subtract" : "Add"} the tops: ${(a.n * L) / a.d} ${sub ? "−" : "+"} ${(b.n * L) / b.d} = ${sub ? (a.n * L) / a.d - (b.n * L) / b.d : (a.n * L) / a.d + (b.n * L) / b.d}.`, `Simplify: ${l === 3 ? mixedStr(r) : fracStr(r)}`] };
      }
    },
  },
  {
    id: "g8.fracmul", grade: 8, strand: "Fractions", title: "Multiply fractions", prereqs: ["g6.gcf", "g6.mixed"],
    gen: (rng) => {
      const a = { n: ri(rng, 1, 8), d: ri(rng, 2, 9) }, b = { n: ri(rng, 1, 8), d: ri(rng, 2, 9) };
      const r = fmul(a, b);
      return { prompt: `${a.n}/${a.d} ${times} ${b.n}/${b.d}  (simplest form)`, speak: say(`${a.n}/${a.d} × ${b.n}/${b.d}, in simplest form`), answer: fracStr(r), kind: "fraction", form: "simplest", steps: [`Top times top: ${a.n} ${times} ${b.n} = ${a.n * b.n}.`, `Bottom times bottom: ${a.d} ${times} ${b.d} = ${a.d * b.d}.`, `Simplify ${a.n * b.n}/${a.d * b.d} = ${fracStr(r)}`] };
    },
  },
  {
    id: "g8.fracdiv", grade: 8, strand: "Fractions", title: "Divide fractions", prereqs: ["g8.fracmul"],
    gen: (rng) => {
      const a = { n: ri(rng, 1, 8), d: ri(rng, 2, 9) }, b = { n: ri(rng, 1, 8), d: ri(rng, 2, 9) };
      const r = fdiv(a, b);
      return { prompt: `${a.n}/${a.d} ${div} ${b.n}/${b.d}  (simplest form)`, speak: say(`${a.n}/${a.d} ÷ ${b.n}/${b.d}, in simplest form`), answer: fracStr(r), kind: "fraction", form: "simplest", steps: [`Dividing by a fraction is multiplying by its flip: ${b.d}/${b.n}.`, `${a.n}/${a.d} ${times} ${b.d}/${b.n} = ${a.n * b.d}/${a.d * b.n}.`, `Simplify: ${fracStr(r)}`] };
    },
  },
  {
    id: "g8.fracorder", grade: 8, strand: "Fractions", title: "Order of operations with fractions", prereqs: ["g8.fracadd", "g8.fracmul", "g6.orderops"],
    gen: (rng) => {
      const a = { n: 1, d: ri(rng, 2, 6) }, b = { n: ri(rng, 1, 3), d: ri(rng, 4, 8) }, c = { n: ri(rng, 1, 3), d: ri(rng, 2, 5) };
      const prod = fmul(b, c), r = fadd(a, prod);
      return { prompt: `${a.n}/${a.d} + ${b.n}/${b.d} ${times} ${c.n}/${c.d}  (simplest form)`, speak: say(`${a.n}/${a.d} + ${b.n}/${b.d} × ${c.n}/${c.d}, in simplest form`), answer: fracStr(r), kind: "fraction", form: "simplest", steps: [`Multiply first: ${b.n}/${b.d} ${times} ${c.n}/${c.d} = ${fracStr(prod)}.`, `Then add: ${a.n}/${a.d} + ${fracStr(prod)} = ${fracStr(r)}.`] };
    },
  },
  {
    id: "g8.percentx", grade: 8, strand: "Decimals & percents", title: "Percents below 1% and above 100%", prereqs: ["g7.fdp", "g7.decops"], calculatorOk: true,
    gen: (rng) => {
      const p = pick(rng, [0.5, 0.2, 0.1, 150, 125, 200, 250, 120] as const), base = pick(rng, [20, 40, 60, 80, 200, 400, 1000] as const);
      return { prompt: `What is ${p}% of ${base}?`, speak: `What is ${p} percent of ${base}?`, answer: fmt((p * base) / 100), kind: "number", steps: [`${p}% as a decimal is ${fmt(p / 100)}.`, `${fmt(p / 100)} ${times} ${base} = ${fmt((p * base) / 100)}`] };
    },
  },
  {
    id: "g8.proportion", grade: 8, strand: "Algebra", title: "Rates and proportions", prereqs: ["g6.ratio", "g7.decops"], calculatorOk: true,
    gen: (rng, l) => {
      if (l < 3) {
        const n = ri(rng, 2, 8), unit = pick(rng, [0.25, 0.5, 0.75, 1.25, 1.5, 2.5] as const), m = ri(rng, 3, 12);
        return { prompt: `${n} bottles of water cost $${(n * unit).toFixed(2)}. How much do ${m} bottles cost?`, speak: `${n} bottles of water cost ${(n * unit).toFixed(2)} dollars. How much do ${m} bottles cost?`, answer: fmt(m * unit), kind: "number", unit: "$", steps: [`Find the cost of 1: ${(n * unit).toFixed(2)} ${div} ${n} = ${unit.toFixed(2)}.`, `Multiply by ${m}: ${unit.toFixed(2)} ${times} ${m} = ${(m * unit).toFixed(2)}.`] };
      }
      const a = ri(rng, 2, 9), b = ri(rng, 2, 9), k = ri(rng, 2, 5), j = ri(rng, 2, 5);
      // x / (b*j) = (a*k) / (b*k)  → x = a*j
      return { prompt: `Solve for x:  x/${b * j} = ${a * k}/${b * k}`, speak: `Solve for x. x over ${b * j} equals ${a * k} over ${b * k}.`, answer: String(a * j), kind: "number", steps: [`Simplify the right side: ${a * k}/${b * k} = ${a}/${b}.`, `${b} became ${b * j}, which is ${times} ${j}.`, `So x = ${a} ${times} ${j} = ${a * j}.`] };
    },
  },
  {
    id: "g8.twostepint", grade: 8, strand: "Algebra", title: "Two-step equations with integers", prereqs: ["g7.twostep", "g7.intmul"],
    gen: (rng) => {
      const x = ri(rng, -9, 9) || 4, k = ri(rng, 2, 9) * pick(rng, [1, -1] as const), c = ri(rng, -12, 12) || 5;
      const rhs = k * x + c;
      const cs = c < 0 ? `− ${-c}` : `+ ${c}`;
      return { prompt: `${minus(k)}x ${cs} = ${minus(rhs)}.  What is x?`, speak: `${k < 0 ? "negative " + -k : k} x ${c < 0 ? "minus " + -c : "plus " + c} equals ${rhs < 0 ? "negative " + -rhs : rhs}. What is x?`, answer: String(x), kind: "number", steps: [`Undo the ${cs} first: ${minus(k)}x = ${minus(rhs)} ${c < 0 ? "+" : "−"} ${Math.abs(c)} = ${minus(k * x)}.`, `Divide both sides by ${minus(k)}: x = ${minus(k * x)} ${div} ${neg(k)} = ${minus(x)}.`] };
    },
  },
  {
    id: "g8.pythag", grade: 8, strand: "Geometry", title: "Pythagorean theorem", prereqs: ["g8.squares"], calculatorOk: true,
    gen: (rng, l) => {
      const t = pick(rng, [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]] as const);
      if (l === 1) return { prompt: `A right triangle has legs of ${t[0]} cm and ${t[1]} cm. How long is the hypotenuse?`, speak: `A right triangle has legs of ${t[0]} and ${t[1]} centimetres. How long is the longest side, the hypotenuse?`, answer: String(t[2]), kind: "number", unit: "cm", steps: [`a² + b² = c²`, `${t[0] ** 2} + ${t[1] ** 2} = ${t[2] ** 2}`, `c = √${t[2] ** 2} = ${t[2]} cm`] };
      if (l === 2) return { prompt: `A right triangle has a hypotenuse of ${t[2]} cm and one leg of ${t[0]} cm. How long is the other leg?`, speak: `A right triangle has a hypotenuse of ${t[2]} centimetres and one leg of ${t[0]}. How long is the other leg?`, answer: String(t[1]), kind: "number", unit: "cm", steps: [`a² + b² = c², so b² = c² − a².`, `${t[2] ** 2} − ${t[0] ** 2} = ${t[1] ** 2}`, `b = √${t[1] ** 2} = ${t[1]} cm`] };
      const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = Math.sqrt(a * a + b * b);
      return { prompt: `A right triangle has legs of ${a} cm and ${b} cm. How long is the hypotenuse, to 1 decimal place?`, speak: `A right triangle has legs of ${a} and ${b} centimetres. How long is the hypotenuse, to one decimal place?`, answer: c.toFixed(1), kind: "number", tol: 0.051, unit: "cm", steps: [`${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}`, `c = √${a * a + b * b} ≈ ${c.toFixed(1)} cm`] };
    },
  },
];

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, Skill>;
export const GRADES = [3, 4, 5, 6, 7, 8] as const;
export const skillsInGrade = (g: number) => SKILLS.filter((s) => s.grade === g);

/** All prerequisites, transitively, nearest first. */
export function ancestors(id: string): string[] {
  const out: string[] = [], seen = new Set<string>(), q = [...SKILL[id].prereqs];
  while (q.length) { const p = q.shift()!; if (seen.has(p)) continue; seen.add(p); out.push(p); q.push(...SKILL[p].prereqs); }
  return out;
}
