/**
 * Stability check used by the Workbench's "stability proof" panel.
 *
 * A stable sort must preserve the input order of equal keys. We verify that on
 * the *actual* output permutation: walk the sorted result, and every time two
 * neighbours compare equal, their original indices must still be increasing.
 *
 * @module core/stability
 */

import { buildComparator } from './keys.ts';
import type { SortKeySpec } from './keys.ts';

export interface StabilityReport {
  /** Number of adjacent equal-key pairs examined. */
  tiePairs: number;
  /** Number of contiguous groups of tied keys. */
  tieGroups: number;
  /** Pairs that were reordered — must be 0 for a stable sort. */
  violations: number;
  /** Largest tied group size found. */
  largestGroup: number;
}

/** Checks a permutation for stability violations against the given key spec. */
export function checkStability(
  spec: SortKeySpec,
  order: Int32Array | number[],
  n: number,
): StabilityReport {
  const cmp = buildComparator(spec);
  let tiePairs = 0;
  let tieGroups = 0;
  let violations = 0;
  let largestGroup = 1;

  let runSize = 1;
  for (let k = 1; k < n; k++) {
    const prev = order[k - 1];
    const cur = order[k];
    if (cmp(prev, cur) === 0) {
      tiePairs++;
      runSize++;
      largestGroup = Math.max(largestGroup, runSize);
      // Stability: the later original index must come after the earlier one.
      if (cur < prev) violations++;
    } else {
      if (runSize > 1) tieGroups++;
      runSize = 1;
    }
  }
  if (runSize > 1) tieGroups++;

  return { tiePairs, tieGroups, violations, largestGroup };
}

/** Quick description of why a tie group matters, used in the UI copy. */
export function describeStability(report: StabilityReport): string {
  if (report.tiePairs === 0) return 'No equal keys in this dataset, so stability cannot be observed here.';
  return (
    `${report.tiePairs.toLocaleString()} equal-key neighbour pairs in ` +
    `${report.tieGroups.toLocaleString()} tie group(s); largest group ${report.largestGroup}.`
  );
}
