import { describe, it, expect } from "vitest";
import { SKILLS, ancestors, SKILL } from "../src/lib/skills";
import { check } from "../src/lib/check";
import { parseNumber } from "../src/lib/math";

// Seeded RNG so failures are reproducible.
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Independent evaluator for prompts that are pure arithmetic.
function evalPrompt(prompt: string): number | null {
  let s = prompt.replace(/\(simplest form\)/, "").trim();
  if (!/^[\d\s.+\-−×÷()/]+$/.test(s)) return null;
  s = s.replace(/−/g, "-").replace(/(\d+) (\d+)\/(\d+)/g, "($1+$2/$3)").replace(/(\d+)\/(\d+)/g, "($1/$2)").replace(/×/g, "*").replace(/÷/g, "/");
  try { return Function(`"use strict";return (${s})`)(); } catch { return null; }
}

describe("skill map", () => {
  it("has valid prerequisite links and no cycles", () => {
    for (const s of SKILLS) {
      for (const p of s.prereqs) { expect(SKILL[p], `${s.id} → ${p}`).toBeDefined(); expect(SKILL[p].grade).toBeLessThanOrEqual(s.grade); }
      expect(ancestors(s.id)).not.toContain(s.id);
    }
  });
});

describe("generators", () => {
  for (const s of SKILLS) for (const level of [1, 2, 3] as const) {
    it(`${s.id} L${level}: answers are self-consistent and independently correct`, () => {
      const rng = mulberry(level * 1000 + s.id.length);
      let independent = 0;
      for (let i = 0; i < 400; i++) {
        const p = s.gen(rng, level);
        expect(p.prompt).not.toMatch(/undefined|NaN|Infinity/);
        expect(p.answer).not.toMatch(/undefined|NaN|Infinity/);
        p.steps.forEach((st) => expect(st).not.toMatch(/undefined|NaN|Infinity/));
        if (p.kind === "choice") expect(p.choices).toContain(p.answer);
        expect(check(p, p.answer).correct, `${p.prompt} → ${p.answer}`).toBe(true);
        const ev = evalPrompt(p.prompt);
        if (ev !== null && p.kind !== "remainder") { independent++; expect(Math.abs(ev - parseNumber(p.answer)!), `${p.prompt} = ${ev}, answer ${p.answer}`).toBeLessThan(1e-6); }
      }
    });
  }
});

describe("marking", () => {
  const frac = { prompt: "", answer: "3/4", kind: "fraction" as const, form: "simplest" as const, steps: [] };
  it("accepts equivalent forms correctly", () => {
    expect(check(frac, "3/4").correct).toBe(true);
    expect(check(frac, "6/8").correct).toBe(false);
    expect(check(frac, "6/8").feedback).toMatch(/simplified/);
    expect(check(frac, "0.75").correct).toBe(false);
    expect(check({ ...frac, answer: "2 1/3", form: "mixed" }, "7/3").feedback).toMatch(/mixed/);
    expect(check({ ...frac, answer: "2 1/3", form: "mixed" }, "2 1/3").correct).toBe(true);
    expect(check({ prompt: "", answer: "-4", kind: "number", steps: [] }, "−4").correct).toBe(true);
    expect(check({ prompt: "", answer: "12 R 3", kind: "remainder", steps: [] }, "12r3").correct).toBe(true);
    expect(check({ prompt: "", answer: "31.4", kind: "number", tol: 0.05, steps: [] }, "31.42").correct).toBe(true);
  });
});
