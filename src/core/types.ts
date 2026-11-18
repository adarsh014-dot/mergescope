/**
 * Shared types for the sorting core.
 *
 * The core operates on *indices*, never on records. A merge sort over an index
 * permutation is exactly equivalent to a merge sort over the records, but it
 * keeps the worker payload small (two typed arrays instead of N objects) and it
 * makes the "moves" metric meaningful — a move is a write into the ordering.
 */

/** Comparison function over two indices in the caller's key space. */
export type Comparator = (a: number, b: number) => number;

/** Everything the UI shows about a sort run. All values are measured at runtime. */
export interface SortMetrics {
  /** Number of key-to-key comparisons performed by the algorithm. */
  comparisons: number;
  /** Number of writes into the ordering array (the merge step's copying work). */
  moves: number;
  /** Number of times the recursive procedure was entered. */
  recursiveCalls: number;
  /** Deepest recursion level reached (0 for a single element). */
  maxDepth: number;
  /** Number of tree levels, i.e. maxDepth + 1. */
  levels: number;
  /** Wall-clock time of the sort phase only. */
  elapsedMs: number;
  /** Largest auxiliary buffer ever allocated, in elements. */
  peakAuxElements: number;
}

/** One node of the recursion tree, recorded from the real execution. */
export interface TreeNode {
  id: string;
  lo: number;
  hi: number;
  depth: number;
  parentId: string | null;
  size: number;
  comparisons: number;
  /** Pre-order visit number, so children keep left-then-right identity. */
  order: number;
}

/** A single replayable step of the algorithm. */
export type SortEvent =
  | { t: 'split'; nodeId: string; lo: number; hi: number; mid: number }
  | { t: 'copy'; k: number; v: number }
  | { t: 'cmp'; nodeId: string; i: number; j: number }
  | { t: 'write'; nodeId: string; k: number; v: number }
  | { t: 'merged'; nodeId: string; lo: number; hi: number };

/** Aggregate cost of one level of the recursion tree. */
export interface LevelStat {
  depth: number;
  nodes: number;
  elements: number;
  comparisons: number;
}

export interface SortResult {
  /** order[i] = original index of the record that belongs at position i. */
  order: Int32Array;
  metrics: SortMetrics;
  tree: TreeNode[];
  events: SortEvent[];
  levels: LevelStat[];
  /** True when tree or event capture was skipped because the input was too large. */
  truncated: boolean;
}

export interface SortOptions {
  /** Capture the recursion tree (disabled above a size limit to protect the tab). */
  recordTree?: boolean;
  /** Capture replayable events for the recursion-tree player. */
  recordEvents?: boolean;
  /** Hard cap on captured events. */
  maxEvents?: number;
}
