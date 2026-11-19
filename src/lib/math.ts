// Exact arithmetic helpers. Every answer in the platform is computed here, never by the AI.

export type Rng = () => number;

export const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
export const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);

/** Round away float noise and print without trailing zeros. */
export function fmt(n: number): string {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
}

export interface Frac { n: number; d: number }

export function simplify(f: Frac): Frac {
  const g = gcd(f.n, f.d);
  const sign = f.d < 0 ? -1 : 1;
  return { n: (sign * f.n) / g, d: (sign * f.d) / g };
}
export const fadd = (a: Frac, b: Frac) => simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const fsub = (a: Frac, b: Frac) => simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const fmul = (a: Frac, b: Frac) => simplify({ n: a.n * b.n, d: a.d * b.d });
export const fdiv = (a: Frac, b: Frac) => simplify({ n: a.n * b.d, d: a.d * b.n });

export function fracStr(f: Frac): string {
  const s = simplify(f);
  return s.d === 1 ? String(s.n) : `${s.n}/${s.d}`;
}
export function mixedStr(f: Frac): string {
  const s = simplify(f);
  if (s.d === 1) return String(s.n);
  const w = Math.trunc(s.n / s.d);
  const r = Math.abs(s.n % s.d);
  if (w === 0) return `${s.n}/${s.d}`;
  return `${w} ${r}/${s.d}`;
}

/** Parse "3", "-2", "0.75", "3/4", "1 3/4", "-1 1/2". Returns null when unreadable. */
export function parseFrac(raw: string): { value: Frac; form: "int" | "proper" | "improper" | "mixed" | "decimal" } | null {
  const s = raw.trim().replace(/\s+/g, " ").replace(/,/g, "");
  let m = s.match(/^(-?\d+) (\d+)\/(\d+)$/);
  if (m) {
    const w = +m[1], n = +m[2], d = +m[3];
    if (!d) return null;
    const sign = w < 0 || m[1].startsWith("-") ? -1 : 1;
    return { value: simplify({ n: sign * (Math.abs(w) * d + n), d }), form: "mixed" };
  }
  m = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (m) {
    const n = +m[1], d = +m[2];
    if (!d) return null;
    return { value: { n, d }, form: Math.abs(n) >= Math.abs(d) ? "improper" : "proper" };
  }
  m = s.match(/^-?\d+$/);
  if (m) return { value: { n: +s, d: 1 }, form: "int" };
  m = s.match(/^-?\d*\.\d+$/);
  if (m) {
    const places = s.split(".")[1].length;
    const d = 10 ** places;
    return { value: simplify({ n: Math.round(parseFloat(s) * d), d }), form: "decimal" };
  }
  return null;
}

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/[,\s$%]/g, "").replace(/^−/, "-");
  if (!/^-?\d*\.?\d+$/.test(s)) {
    const f = parseFrac(raw);
    return f ? f.value.n / f.value.d : null;
  }
  return parseFloat(s);
}
