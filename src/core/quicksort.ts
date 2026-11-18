/**
 * Quicksort (Lomuto partition, last-element pivot) over an index permutation.
 *
 * This is here for contrast, not for the main path:
 *   - it sorts **in place** (Θ(log n) stack, no Θ(n) buffer), but
 *   - it is **unstable**, and
 *   - it degrades to Θ(n²) on already-sorted input — exactly what a log file
 *     sorted by timestamp looks like on the second pass.
 *
 * Both facts are demonstrated in the app's stability and benchmark panels.
 *
 * @module core/quicksort
 */

import type { Comparator } from './types.ts';

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

export interface BenchResult {
  order: Int32Array;
  comparisons: number;
  elapsedMs: number;
  /** Extra elements of memory used beyond the input, in elements. */
  auxElements: number;
  depth: number;
}

export function quickSortIndices(n: number, cmp: Comparator): BenchResult {
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;

  let comparisons = 0;
  let maxDepth = 0;

  const a = order;

  function partition(lo: number, hi: number): number {
    const pivot = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      comparisons++;
      if (cmp(a[j], pivot) <= 0) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
      }
    }
    const t = a[i];
    a[i] = a[hi];
    a[hi] = t;
    return i;
  }

  function qs(lo: number, hi: number, depth: number): void {
    if (depth > maxDepth) maxDepth = depth;
    if (lo >= hi) return;
    const p = partition(lo, hi);
    qs(lo, p - 1, depth + 1);
    qs(p + 1, hi, depth + 1);
  }

  const started = now();
  if (n > 1) qs(0, n - 1, 0);
  const elapsedMs = now() - started;

  return { order, comparisons, elapsedMs, auxElements: 0, depth: maxDepth };
}

/** Insertion sort — the stable O(n²) baseline, only ever used on small inputs. */
export function insertionSortIndices(n: number, cmp: Comparator): BenchResult {
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;

  let comparisons = 0;
  const started = now();

  for (let i = 1; i < n; i++) {
    const key = order[i];
    let j = i - 1;
    while (j >= 0) {
      comparisons++;
      if (cmp(order[j], key) <= 0) break;
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = key;
  }

  return {
    order,
    comparisons,
    elapsedMs: now() - started,
    auxElements: 0,
    depth: 0,
  };
}
