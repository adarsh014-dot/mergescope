/**
 * Worker message protocol. Keeping it in one file means the worker and the UI
 * can never drift apart.
 *
 * @module workers/protocol
 */

import type { SortKeySpec } from '../core/keys.ts';
import type { SortOptions, SortResult } from '../core/types.ts';

export type WorkerRequest =
  | { id: number; type: 'sort'; n: number; spec: SortKeySpec; options: SortOptions }
  | { id: number; type: 'bench'; sizes: number[]; seed: number; pattern: 'random' | 'sorted' };

export interface BenchRow {
  alg: 'merge' | 'quick' | 'native' | 'insertion';
  n: number;
  comparisons: number;
  elapsedMs: number;
  auxElements: number;
  depth: number;
}

/** `Omit` that distributes over a union, so a request without an id stays a union. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type WorkerRequestBody = DistributiveOmit<WorkerRequest, 'id'>;

export type WorkerResponse =
  | { id: number; ok: true; type: 'sort'; result: SortResult }
  | { id: number; ok: true; type: 'bench'; rows: BenchRow[] }
  | { id: number; ok: false; error: string };
