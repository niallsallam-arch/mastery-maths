import { describe, it, expect } from "vitest";
import { SKILLS, SKILL, sayStep } from "../src/lib/skills";
import { clampMultiplier, factIsFluent, factTargetMs, countsTowardMastery, masteryReached, blockSizes, blockInfo } from "../src/lib/rules";
import { evaluate, show } from "../src/lib/calc";

describe("extra time on speed targets", () => {
  it("keeps the multiplier between 1.0 and 2.0, defaulting to 1.5", () => {
    expect(clampMultiplier(0.5)).toBe(1);
    expect(clampMultiplier(3)).toBe(2);
    expect(clampMultiplier(1.3)).toBe(1.3);
    expect(clampMultiplier("1.8")).toBe(1.8);
    expect(clampMultiplier(undefined)).toBe(1.5);
    expect(clampMultiplier("abc")).toBe(1.5);
  });
  it("scales the fact fluency target", () => {
    expect(factTargetMs(1)).toBe(3000);
    expect(factTargetMs(1.5)).toBe(4500);
    expect(factTargetMs(2)).toBe(6000);
    expect(factIsFluent(true, 4000, 1.5)).toBe(true);
    expect(factIsFluent(true, 4000, 1.0)).toBe(false);
    expect(factIsFluent(true, 4501, 1.5)).toBe(false);
    expect(factIsFluent(false, 1000, 2)).toBe(false);
  });
  it("scales each skill's speed target for mastery", () => {
    const fluencyMs = SKILL["g4.mulfacts"].fluencyMs!; // 6000
    expect(countsTowardMastery(true, 8000, fluencyMs, 1.5)).toBe(true);
    expect(countsTowardMastery(true, 8000, fluencyMs, 1.0)).toBe(false);
    expect(countsTowardMastery(true, 99_000, undefined, 1.0)).toBe(true); // no speed target on this skill
    const eightSlowButRight = Array.from({ length: 8 }, () => ({ correct: true, ms: 8000 }));
    expect(masteryReached(eightSlowButRight, fluencyMs, 1.5)).toBe(true);
    expect(masteryReached(eightSlowButRight, fluencyMs, 1.0)).toBe(false);
  });
  it("keeps the mastery rule itself unchanged", () => {
    const right = { correct: true, ms: 1000 }, wrong = { correct: false, ms: 1000 };
    expect(masteryReached(Array(7).fill(right), undefined, 1.5)).toBe(false);            // fewer than 8
    expect(masteryReached(Array(8).fill(right), undefined, 1.5)).toBe(true);
    expect(masteryReached([wrong, ...Array(9).fill(right)], undefined, 1.5)).toBe(false); // latest one wrong
    expect(masteryReached([right, wrong, ...Array(8).fill(right)], undefined, 1.5)).toBe(true);  // 9 of 10
    expect(masteryReached([right, wrong, wrong, ...Array(7).fill(right)], undefined, 1.5)).toBe(false); // 8 of 10
  });
});

describe("calculator flag", () => {
  const allowed = ["g6.percent", "g7.circle", "g8.percentx", "g8.proportion", "g8.pythag"];
  it("is set on exactly the applied-problem skills", () => {
    expect(SKILLS.filter((s) => s.calculatorOk).map((s) => s.id).sort()).toEqual(allowed);
  });
  it("is never set on arithmetic, fraction, integer or decimal operation skills, or anything with a speed target", () => {
    const decimalOps = ["g4.decimals", "g5.decaddsub", "g6.decmuldiv", "g7.decops", "g7.fdp"];
    for (const s of SKILLS) {
      const mustBeOff = s.strand === "Operations" || s.strand === "Fractions" || s.strand === "Number" || decimalOps.includes(s.id) || !!s.fluencyMs;
      if (mustBeOff) expect(s.calculatorOk, s.id).toBeFalsy();
    }
  });
});

describe("challenge blocks", () => {
  it("splits evenly with at most 6 per block", () => {
    expect(blockSizes(8)).toEqual([4, 4]);
    expect(blockSizes(12)).toEqual([6, 6]);
    expect(blockSizes(14)).toEqual([5, 5, 4]);
    expect(blockSizes(16)).toEqual([6, 5, 5]);
    expect(blockSizes(18)).toEqual([6, 6, 6]);
    expect(blockSizes(6)).toEqual([6]);
    expect(blockSizes(0)).toEqual([]);
  });
  it("covers every real challenge length", () => {
    for (const g of [3, 4, 5, 6, 7, 8]) {
      const total = SKILLS.filter((s) => s.grade === g).length * 2, sizes = blockSizes(total);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(6);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(4);
    }
  });
  it("places each question in its block", () => {
    expect(blockInfo(0, 18)).toMatchObject({ block: 1, blocks: 3, q: 1, blockSize: 6, lastInBlock: false, lastBlock: false });
    expect(blockInfo(5, 18)).toMatchObject({ block: 1, q: 6, lastInBlock: true, lastBlock: false });
    expect(blockInfo(6, 18)).toMatchObject({ block: 2, q: 1, lastInBlock: false });
    expect(blockInfo(8, 18)).toMatchObject({ block: 2, q: 3, blockSize: 6 }); // "Block 2 · question 3 of 6", was question 9 of 18
    expect(blockInfo(17, 18)).toMatchObject({ block: 3, q: 6, lastInBlock: true, lastBlock: true });
    expect(blockInfo(4, 14)).toMatchObject({ block: 1, q: 5, blockSize: 5, lastInBlock: true });
    expect(blockInfo(10, 14)).toMatchObject({ block: 3, q: 1, blockSize: 4, lastBlock: true });
  });
  it("has a checkpoint after every block except the last", () => {
    for (const total of [8, 12, 14, 16, 18]) {
      const ends = Array.from({ length: total }, (_, i) => blockInfo(i, total)).filter((b) => b.lastInBlock && !b.lastBlock);
      expect(ends.length).toBe(blockSizes(total).length - 1);
    }
  });
});

describe("calculator", () => {
  it("follows the order of operations", () => {
    expect(evaluate("2 + 3 × 4")).toBe(14);
    expect(evaluate("(2 + 3) × 4")).toBe(20);
    expect(evaluate("10 − 4 ÷ 2")).toBe(8);
    expect(evaluate("-3 + 5")).toBe(2);
  });
  it("handles decimals and square roots", () => {
    expect(show(evaluate("0.1 + 0.2")!)).toBe("0.3");
    expect(show(evaluate("2 × 3.14 × 5")!)).toBe("31.4");
    expect(evaluate("√25")).toBe(5);
    expect(evaluate("√(9 + 16)")).toBe(5);
    expect(show(evaluate("0.25 × 80")!)).toBe("20");
  });
  it("gives no answer for things it cannot work out", () => {
    for (const bad of ["", "5 ÷ 0", "2 +", "1.2.3", "√-4", "(2 + 3", "alert(1)", "2 3"]) expect(evaluate(bad), bad).toBeNull();
  });
});

describe("worked example read-aloud", () => {
  it("turns symbols into words", () => {
    expect(sayStep("c = √25 = 5 cm")).toBe("c equals the square root of 25 equals 5 cm");
    expect(sayStep("3² + 4² = 25")).toMatch(/3 squared \+ 4 squared equals 25/);
  });
});
