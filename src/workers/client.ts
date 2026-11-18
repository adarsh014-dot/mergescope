/**
 * Thin promise wrapper around the sorting worker, with request de-duplication.
 *
 * @module workers/client
 */

import type { SortKeySpec } from '../core/keys.ts';
import type { SortOptions, SortResult } from '../core/types.ts';
import type {
  BenchRow,
  WorkerRequestBody,
  WorkerRequest,
  WorkerResponse,
} from './protocol.ts';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (value: never) => void; reject: (error: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./sort.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.ok) (entry.resolve as (v: unknown) => void)(message);
    else entry.reject(new Error(message.error));
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Sorting worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function call<T>(request: WorkerRequestBody): Promise<T> {
  const id = ++seq;
  const w = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: never) => void, reject });
    w.postMessage({ ...request, id } as WorkerRequest);
  });
}

/** Sorts a projected key series and returns metrics, tree and events. */
export async function sortInWorker(
  n: number,
  spec: SortKeySpec,
  options: SortOptions,
): Promise<SortResult> {
  const message = await call<Extract<WorkerResponse, { type: 'sort' }>>({
    type: 'sort',
    n,
    spec,
    options,
  });
  return message.result;
}

/** Runs the merge/quick/native benchmark for the complexity lab. */
export async function benchInWorker(
  sizes: number[],
  seed: number,
  pattern: 'random' | 'sorted',
): Promise<BenchRow[]> {
  const message = await call<Extract<WorkerResponse, { type: 'bench' }>>({
    type: 'bench',
    sizes,
    seed,
    pattern,
  });
  return message.rows;
}

export function terminateWorker(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
