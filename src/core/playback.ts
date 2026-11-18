/**
 * Playback engine for the recursion-tree lab.
 *
 * The player holds **no sorting logic**. It replays the recorded event stream and
 * rebuilds the two arrays (the ordering and the auxiliary buffer) the algorithm
 * was holding at that instant. That is what makes "step back" possible without
 * running the algorithm in reverse.
 *
 * @module core/playback
 */

import type { SortEvent } from './types.ts';

export interface Frame {
  /** Step number, 0 = before the first event. */
  index: number;
  kind: SortEvent['t'] | 'start';
  /** Human-readable description of what just happened. */
  label: string;
  /** The ordering array at this instant (values are original indices). */
  order: number[];
  /** The auxiliary buffer at this instant; -1 means "not copied yet". */
  aux: number[];
  /** Active range [lo, hi) for the current recursion node. */
  lo: number;
  hi: number;
  /** Primary highlighted position (compare i / write k). */
  at: number;
  /** Secondary highlighted position (compare j). */
  at2: number;
  nodeId: string | null;
}

const EMPTY = -1;

function parseNodeId(id: string): { lo: number; hi: number } {
  const [lo, hi] = id.split(':').map(Number);
  return { lo, hi };
}

/** Replays events and returns one immutable snapshot per step. */
export function buildFrames(events: SortEvent[], n: number): Frame[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const aux = new Array<number>(n).fill(EMPTY);

  const frames: Frame[] = [
    {
      index: 0,
      kind: 'start',
      label: 'Before the first call. Everything is still in file order.',
      order: [...order],
      aux: [...aux],
      lo: 0,
      hi: n,
      at: -1,
      at2: -1,
      nodeId: null,
    },
  ];

  let lo = 0;
  let hi = n;
  let at = -1;
  let at2 = -1;
  let nodeId: string | null = null;
  let label = '';

  for (let e = 0; e < events.length; e++) {
    const event = events[e];
    switch (event.t) {
      case 'split': {
        lo = event.lo;
        hi = event.hi;
        nodeId = event.nodeId;
        at = -1;
        at2 = -1;
        label = `Split [${event.lo}, ${event.hi}) at ${event.mid} → recurse left, then right.`;
        break;
      }
      case 'copy': {
        aux[event.k] = event.v;
        at = event.k;
        at2 = -1;
        label = `Copy position ${event.k} into the auxiliary buffer.`;
        break;
      }
      case 'cmp': {
        at = event.i;
        at2 = event.j;
        nodeId = event.nodeId;
        const range = parseNodeId(event.nodeId);
        lo = range.lo;
        hi = range.hi;
        label = `Compare aux[${event.i}] with aux[${event.j}] — the next write takes the smaller one.`;
        break;
      }
      case 'write': {
        order[event.k] = event.v;
        at = event.k;
        at2 = -1;
        nodeId = event.nodeId;
        label = `Write original index ${event.v} into position ${event.k}.`;
        break;
      }
      case 'merged': {
        lo = event.lo;
        hi = event.hi;
        at = -1;
        at2 = -1;
        nodeId = event.nodeId;
        label = `Merged — [${event.lo}, ${event.hi}) is now sorted.`;
        break;
      }
    }

    frames.push({
      index: frames.length,
      kind: event.t,
      label,
      order: [...order],
      aux: [...aux],
      lo,
      hi,
      at,
      at2,
      nodeId,
    });
  }

  return frames;
}
