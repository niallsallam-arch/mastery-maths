// Pure rules used by the engine and the screens. No database access here, so they are easy to test.

export const FACT_FLUENT_MS = 3000;
export const DEFAULT_TIME_MULTIPLIER = 1.5;

/** The "extra time on speed targets" learner setting, kept between 1.0 and 2.0. */
export function clampMultiplier(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return DEFAULT_TIME_MULTIPLIER;
  return Math.round(Math.min(2, Math.max(1, n)) * 100) / 100;
}

/** The speed target for a fact, after extra time. */
export const factTargetMs = (mult: number) => Math.round(FACT_FLUENT_MS * clampMultiplier(mult));

export const factIsFluent = (correct: boolean, ms: number, mult: number) => correct && ms <= factTargetMs(mult);

/** A practice answer counts toward mastery if it is right and, where the skill has a speed target, inside it. */
export function countsTowardMastery(correct: boolean, ms: number, fluencyMs: number | undefined, mult: number): boolean {
  return correct && (!fluencyMs || ms <= fluencyMs * clampMultiplier(mult));
}

/** Mastery rule: at least 8 grade-level answers, 90% of the last 10 counting, and the latest one counting. `graded` is newest first. */
export function masteryReached(graded: { correct: boolean; ms: number }[], fluencyMs: number | undefined, mult: number): boolean {
  const counts = graded.slice(0, 10).map((g) => countsTowardMastery(g.correct, g.ms, fluencyMs, mult));
  return counts.length >= 8 && counts.filter(Boolean).length >= Math.ceil(counts.length * 0.9) && counts[0];
}

// ── challenge blocks
export const MAX_BLOCK = 6;

/** Split a challenge into the fewest blocks of at most 6 questions, as evenly as possible (14 → 5, 5, 4). */
export function blockSizes(total: number): number[] {
  if (total <= 0) return [];
  const n = Math.ceil(total / MAX_BLOCK), base = Math.floor(total / n), extra = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface BlockInfo { block: number; blocks: number; q: number; blockSize: number; lastInBlock: boolean; lastBlock: boolean }

/** Where question `idx` (0-based) sits: block number, question number within it, and whether it closes the block. */
export function blockInfo(idx: number, total: number): BlockInfo {
  const sizes = blockSizes(total);
  let start = 0;
  for (let b = 0; b < sizes.length; b++) {
    if (idx < start + sizes[b]) return { block: b + 1, blocks: sizes.length, q: idx - start + 1, blockSize: sizes[b], lastInBlock: idx === start + sizes[b] - 1, lastBlock: b === sizes.length - 1 };
    start += sizes[b];
  }
  const last = sizes.length || 1;
  return { block: last, blocks: last, q: sizes[last - 1] ?? 1, blockSize: sizes[last - 1] ?? 1, lastInBlock: true, lastBlock: true };
}
