/**
 * Core algorithm tests.
 *
 * These assert the properties the report claims: correctness, stability, tree
 * shape, depth against ⌈log₂n⌉, level cost, comparison bounds, and that the
 * playback frames are a faithful replay of the recorded run.
 */

import { describe, expect, it } from 'vitest';

import { mergeSortIndices, theoreticalDepth } from '../src/core/mergesort.ts';
import { buildComparator } from '../src/core/keys.ts';
import type { KeySeries } from '../src/core/keys.ts';
import { buildFrames } from '../src/core/playback.ts';
import { checkStability } from '../src/core/stability.ts';
import { mulberry32 } from '../src/data/samples.ts';

function series(values: number[]): KeySeries {
  return { kind: 'num', values: Float64Array.from(values) };
}

function cmpFor(values: number[], order: 'asc' | 'desc' = 'asc') {
  return buildComparator({ primary: series(values), primaryOrder: order });
}

function sortedCopy(values: number[], order: 'asc' | 'desc' = 'asc'): number[] {
  return [...values].sort((a, b) => (order === 'desc' ? b - a : a - b));
}

function permutationValues(values: number[], order: Int32Array): number[] {
  return Array.from(order, (i) => values[i]);
}

describe('merge sort correctness', () => {
  it('sorts the empty input', () => {
    const result = mergeSortIndices(0, () => 0);
    expect(result.order.length).toBe(0);
    expect(result.metrics.comparisons).toBe(0);
    expect(result.metrics.levels).toBe(0);
  });

  it('leaves a single element untouched', () => {
    const result = mergeSortIndices(1, () => 0);
    expect(Array.from(result.order)).toEqual([0]);
    expect(result.metrics.maxDepth).toBe(0);
    expect(result.metrics.levels).toBe(1);
  });

  const sizes = [2, 3, 4, 5, 7, 8, 9, 16, 17, 64, 100, 257, 1000];
  for (const n of sizes) {
    it(`matches the reference sort for n = ${n} (random)`, () => {
      const rnd = mulberry32(n);
      const values = Array.from({ length: n }, () => Math.floor(rnd() * 1000));
      const result = mergeSortIndices(n, cmpFor(values), {});
      expect(permutationValues(values, result.order)).toEqual(sortedCopy(values));
    });
  }

  it('handles descending order', () => {
    const values = [5, 3, 9, 1, 7, 2];
    const result = mergeSortIndices(values.length, cmpFor(values, 'desc'), {});
    expect(permutationValues(values, result.order)).toEqual(sortedCopy(values, 'desc'));
  });

  it('handles duplicates, already-sorted and reverse-sorted input', () => {
    const cases: number[][] = [
      [4, 4, 4, 4, 4],
      [1, 2, 3, 4, 5, 6, 7, 8],
      [8, 7, 6, 5, 4, 3, 2, 1],
      [0, 0, 1, 1, 0, 1, 0],
    ];
    for (const values of cases) {
      const result = mergeSortIndices(values.length, cmpFor(values), {});
      expect(permutationValues(values, result.order)).toEqual(sortedCopy(values));
    }
  });

  it('sorts 50,000 records without exceeding the comparison ceiling', () => {
    const n = 50_000;
    const rnd = mulberry32(11);
    const values = Array.from({ length: n }, () => rnd());
    const result = mergeSortIndices(n, cmpFor(values), {});
    expect(permutationValues(values, result.order)).toEqual(sortedCopy(values));
    expect(result.metrics.comparisons).toBeLessThanOrEqual(n * Math.ceil(Math.log2(n)));
  });
});

describe('merge sort invariants', () => {
  it('reports depth = ⌈log₂n⌉ for n = 1..64', () => {
    for (let n = 1; n <= 64; n++) {
      const rnd = mulberry32(n + 100);
      const values = Array.from({ length: n }, () => rnd());
      const result = mergeSortIndices(n, cmpFor(values), { recordTree: true });
      expect(result.metrics.maxDepth).toBe(theoreticalDepth(n));
      expect(result.metrics.levels).toBe(theoreticalDepth(n) + 1);
    }
  });

  it('builds a recursion tree with exactly 2n − 1 nodes', () => {
    for (const n of [1, 2, 5, 16, 17, 64, 100]) {
      const rnd = mulberry32(n);
      const values = Array.from({ length: n }, () => rnd());
      const result = mergeSortIndices(n, cmpFor(values), { recordTree: true });
      expect(result.tree.length).toBe(2 * n - 1);
    }
  });

  it('makes every level above the deepest touch exactly n elements', () => {
    // The final level only contains the elements on the longest branches, so it
    // is allowed to be smaller — every level above it is a full partition.
    for (const n of [8, 64, 100, 257]) {
      const rnd = mulberry32(n);
      const values = Array.from({ length: n }, () => rnd());
      const result = mergeSortIndices(n, cmpFor(values), { recordTree: true });
      for (let d = 0; d < result.levels.length; d++) {
        const level = result.levels[d];
        if (d < result.levels.length - 1) expect(level.elements).toBe(n);
        else expect(level.elements).toBeLessThanOrEqual(n);
      }
    }
  });

  it('sums node comparisons to the global comparison count', () => {
    const n = 128;
    const rnd = mulberry32(3);
    const values = Array.from({ length: n }, () => rnd());
    const result = mergeSortIndices(n, cmpFor(values), { recordTree: true });
    const total = result.tree.reduce((sum, node) => sum + node.comparisons, 0);
    expect(total).toBe(result.metrics.comparisons);
  });

  it('keeps comparisons between n − 1 and n·⌈log₂n⌉', () => {
    for (const n of [2, 3, 10, 64, 500]) {
      const rnd = mulberry32(n);
      const values = Array.from({ length: n }, () => rnd());
      const result = mergeSortIndices(n, cmpFor(values), {});
      expect(result.metrics.comparisons).toBeGreaterThanOrEqual(n - 1);
      expect(result.metrics.comparisons).toBeLessThanOrEqual(n * Math.ceil(Math.log2(n)));
    }
  });

  it('allocates a buffer of exactly n elements', () => {
    const values = [3, 1, 2];
    const result = mergeSortIndices(3, cmpFor(values), {});
    expect(result.metrics.peakAuxElements).toBe(3);
  });
});

describe('stability', () => {
  it('preserves input order for equal keys', () => {
    // every record has the same key, so output order must equal input order
    const values = new Array(20).fill(5);
    const spec = { primary: series(values), primaryOrder: 'asc' as const };
    const result = mergeSortIndices(values.length, buildComparator(spec), {});
    expect(Array.from(result.order)).toEqual(values.map((_, i) => i));
    expect(checkStability(spec, result.order, values.length).violations).toBe(0);
  });

  it('keeps ties ordered when a secondary key is used', () => {
    const primary = [1, 1, 1, 0, 0, 1];
    const secondary = [3, 1, 2, 9, 8, 0];
    const spec = {
      primary: series(primary),
      primaryOrder: 'asc' as const,
      secondary: series(secondary),
      secondaryOrder: 'asc' as const,
    };
    const result = mergeSortIndices(primary.length, buildComparator(spec), {});
    const rows = Array.from(result.order, (i) => [primary[i], secondary[i]]);
    expect(rows).toEqual([
      [0, 8],
      [0, 9],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it('sorts missing keys last in both directions', () => {
    const values = [3, Number.NaN, 1, Number.NaN, 2];
    for (const order of ['asc', 'desc'] as const) {
      const result = mergeSortIndices(values.length, cmpFor(values, order), {});
      const tail = Array.from(result.order).slice(-2);
      expect(tail.every((i) => Number.isNaN(values[i]))).toBe(true);
    }
  });
});

describe('playback', () => {
  it('replays to the same order the algorithm produced', () => {
    const n = 24;
    const rnd = mulberry32(99);
    const values = Array.from({ length: n }, () => rnd());
    const result = mergeSortIndices(n, cmpFor(values), { recordTree: true, recordEvents: true });
    const frames = buildFrames(result.events, n);
    const last = frames[frames.length - 1];
    expect(last.order).toEqual(Array.from(result.order));
  });

  it('starts from the identity permutation', () => {
    const result = mergeSortIndices(8, cmpFor([5, 4, 3, 2, 1, 0, 9, 8]), {
      recordEvents: true,
    });
    const frames = buildFrames(result.events, 8);
    expect(frames[0].order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('produces frames for every event', () => {
    const result = mergeSortIndices(8, cmpFor([1, 2, 3, 4, 5, 6, 7, 8]), { recordEvents: true });
    const frames = buildFrames(result.events, 8);
    expect(frames.length).toBe(result.events.length + 1);
  });
});
