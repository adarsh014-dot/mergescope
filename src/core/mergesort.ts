/**
 * MergeScope's merge sort — written from scratch, fully instrumented.
 *
 * This is a top-down, recursive merge sort over an *index permutation*
 * (see types.ts). It never calls Array.prototype.sort.
 *
 * Invariants you can rely on (and which the test suite asserts):
 *   - stable: equal keys keep their original relative order
 *   - Θ(n log n) comparisons in the best, average and worst case
 *   - one auxiliary buffer of n elements, allocated once → Θ(n) extra space
 *   - recursion depth = ceil(log2 n) for n > 1
 *   - recursion tree has exactly 2n − 1 nodes
 *
 * @module core/mergesort
 */

import type {
  Comparator,
  LevelStat,
  SortEvent,
  SortMetrics,
  SortOptions,
  SortResult,
  TreeNode,
} from './types.ts';

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

/**
 * Sort the indices 0..n-1 so that the caller's comparator orders them.
 *
 * @param n       How many indices to sort.
 * @param cmp     Comparator over indices; negative means "a before b".
 * @param options Capture options (tree / events). Capture never changes the sort.
 * @returns The permutation plus measured metrics, the recursion tree and events.
 */
export function mergeSortIndices(
  n: number,
  cmp: Comparator,
  options: SortOptions = {},
): SortResult {
  const { recordTree = false, recordEvents = false, maxEvents = 20_000 } = options;

  const tree: TreeNode[] = [];
  const events: SortEvent[] = [];
  let truncated = false;

  const metrics: SortMetrics = {
    comparisons: 0,
    moves: 0,
    recursiveCalls: 0,
    maxDepth: 0,
    levels: 0,
    elapsedMs: 0,
    peakAuxElements: 0,
  };

  // Per-level aggregates are cheap, so they are always collected.
  const levelNodes: number[] = [];
  const levelElements: number[] = [];
  const levelComparisons: number[] = [];

  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;

  let aux: Int32Array | null = null;

  /** Appends an event unless capture is off or the budget is exhausted. */
  function emit(ev: SortEvent): void {
    if (!recordEvents) return;
    if (events.length >= maxEvents) {
      truncated = true;
      return;
    }
    events.push(ev);
  }

  /**
   * Recursively sorts order[lo, hi).
   * @param depth   0 at the root; children are depth + 1.
   * @param parentId id of the calling node, or null at the root.
   */
  function sortRange(lo: number, hi: number, depth: number, parentId: string | null): void {
    metrics.recursiveCalls++;
    if (depth > metrics.maxDepth) metrics.maxDepth = depth;

    levelNodes[depth] = (levelNodes[depth] ?? 0) + 1;
    levelElements[depth] = (levelElements[depth] ?? 0) + (hi - lo);
    levelComparisons[depth] ??= 0;

    const id = `${lo}:${hi}`;
    let node: TreeNode | null = null;
    if (recordTree) {
      node = {
        id,
        lo,
        hi,
        depth,
        parentId,
        size: hi - lo,
        comparisons: 0,
        order: tree.length,
      };
      tree.push(node);
    }

    // Base case: a run of length 0 or 1 is already sorted.
    if (hi - lo < 2) return;

    const mid = (lo + hi) >> 1;
    emit({ t: 'split', nodeId: id, lo, hi, mid });

    sortRange(lo, mid, depth + 1, id);
    sortRange(mid, hi, depth + 1, id);

    mergeRange(lo, mid, hi, depth, node);
    emit({ t: 'merged', nodeId: id, lo, hi });
    truncated = truncated || events.length >= maxEvents;
  }

  /** Merges the two sorted halves order[lo,mid) and order[mid,hi). */
  function mergeRange(
    lo: number,
    mid: number,
    hi: number,
    depth: number,
    node: TreeNode | null,
  ): void {
    if (aux === null) {
      aux = new Int32Array(n);
      metrics.peakAuxElements = n;
    }
    const tmp = aux;

    // Copy the whole range into the auxiliary buffer. Writing into `order` only
    // after the merge is what makes the algorithm stable and easy to prove.
    for (let k = lo; k < hi; k++) {
      tmp[k] = order[k];
      emit({ t: 'copy', k, v: tmp[k] });
    }

    let i = lo; // cursor into the left run
    let j = mid; // cursor into the right run
    let k = lo; // cursor into the output

    while (i < mid && j < hi) {
      metrics.comparisons++;
      levelComparisons[depth] += 1;
      if (node) node.comparisons += 1;
      emit({ t: 'cmp', nodeId: `${lo}:${hi}`, i, j });

      // `<= 0` takes from the LEFT run on ties → stability.
      if (cmp(tmp[i], tmp[j]) <= 0) {
        order[k] = tmp[i];
        i++;
      } else {
        order[k] = tmp[j];
        j++;
      }
      metrics.moves++;
      emit({ t: 'write', nodeId: `${lo}:${hi}`, k, v: order[k] });
      k++;
    }

    // Drain whichever run still has elements. No comparisons are needed here.
    while (i < mid) {
      order[k] = tmp[i];
      metrics.moves++;
      emit({ t: 'write', nodeId: `${lo}:${hi}`, k, v: order[k] });
      i++;
      k++;
    }
    while (j < hi) {
      order[k] = tmp[j];
      metrics.moves++;
      emit({ t: 'write', nodeId: `${lo}:${hi}`, k, v: order[k] });
      j++;
      k++;
    }
  }

  const started = now();
  if (n > 0) sortRange(0, n, 0, null);
  metrics.elapsedMs = now() - started;
  metrics.levels = n === 0 ? 0 : metrics.maxDepth + 1;

  const levels: LevelStat[] = [];
  for (let d = 0; d < metrics.levels; d++) {
    levels.push({
      depth: d,
      nodes: levelNodes[d] ?? 0,
      elements: levelElements[d] ?? 0,
      comparisons: levelComparisons[d] ?? 0,
    });
  }

  return { order, metrics, tree, events, levels, truncated };
}

/** Theoretical recursion depth of a top-down merge sort over n elements. */
export function theoreticalDepth(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

/** Upper bound on comparisons for n elements: n·⌈log2 n⌉. */
export function comparisonUpperBound(n: number): number {
  return n <= 1 ? 0 : n * Math.ceil(Math.log2(n));
}
