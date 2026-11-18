/**
 * Key extraction and comparator construction.
 *
 * Records are parsed once on the main thread. Each sort key is projected into a
 * compact series (numbers in a Float64Array, or strings in a plain array) so the
 * exact same comparator can be rebuilt inside the worker without shipping the
 * records themselves across the thread boundary.
 *
 * @module core/keys
 */

import type { Comparator } from './types.ts';

export type KeyKind = 'num' | 'str';

/** A projected key: either all-numeric or all-text. */
export type KeySeries =
  | { kind: 'num'; values: Float64Array }
  | { kind: 'str'; values: string[] };

export type SortOrder = 'asc' | 'desc';

export interface SortKeySpec {
  primary: KeySeries;
  primaryOrder: SortOrder;
  secondary?: KeySeries;
  secondaryOrder?: SortOrder;
}

const MISSING_TEXT = '';

/** Truncates a key series to its first `n` values (used by the tree lab). */
export function sliceSeries(series: KeySeries, n: number): KeySeries {
  if (series.kind === 'num') return { kind: 'num', values: series.values.slice(0, n) };
  return { kind: 'str', values: series.values.slice(0, n) };
}

function isMissingNumeric(v: number): boolean {
  return !Number.isFinite(v);
}

/**
 * Builds the comparator used by every algorithm in the app.
 *
 * Rules, applied in order:
 *  1. Missing values (NaN / empty text) always sort last, in both directions.
 *  2. Primary key, then secondary key.
 *  3. Ties return exactly 0 so a stable algorithm keeps the original order.
 */
export function buildComparator(spec: SortKeySpec): Comparator {
  const p = spec.primary;
  const s = spec.secondary;
  const pSign = spec.primaryOrder === 'desc' ? -1 : 1;
  const sSign = spec.secondaryOrder === 'desc' ? -1 : 1;

  if (p.kind === 'num') {
    const pv = p.values;
    if (s && s.kind === 'num') {
      const sv = s.values;
      return (a, b) => {
        const pa = pv[a];
        const pb = pv[b];
        const ma = isMissingNumeric(pa);
        const mb = isMissingNumeric(pb);
        if (ma !== mb) return ma ? 1 : -1;
        if (!ma && pa !== pb) return pa < pb ? -pSign : pSign;
        const sa = sv[a];
        const sb = sv[b];
        const sa2 = isMissingNumeric(sa);
        const sb2 = isMissingNumeric(sb);
        if (sa2 !== sb2) return sa2 ? 1 : -1;
        if (!sa2 && sa !== sb) return sa < sb ? -sSign : sSign;
        return 0;
      };
    }
    if (s && s.kind === 'str') {
      const sv = s.values;
      return (a, b) => {
        const pa = pv[a];
        const pb = pv[b];
        const ma = isMissingNumeric(pa);
        const mb = isMissingNumeric(pb);
        if (ma !== mb) return ma ? 1 : -1;
        if (!ma && pa !== pb) return pa < pb ? -pSign : pSign;
        const sa = sv[a] ?? MISSING_TEXT;
        const sb = sv[b] ?? MISSING_TEXT;
        if (sa !== sb) return (sa < sb ? -1 : 1) * sSign;
        return 0;
      };
    }
    return (a, b) => {
      const pa = pv[a];
      const pb = pv[b];
      const ma = isMissingNumeric(pa);
      const mb = isMissingNumeric(pb);
      if (ma !== mb) return ma ? 1 : -1;
      if (!ma && pa !== pb) return pa < pb ? -pSign : pSign;
      return 0;
    };
  }

  const pv = p.values;
  if (s && s.kind === 'num') {
    const sv = s.values;
    return (a, b) => {
      const pa = pv[a] ?? MISSING_TEXT;
      const pb = pv[b] ?? MISSING_TEXT;
      const ma = pa === MISSING_TEXT;
      const mb = pb === MISSING_TEXT;
      if (ma !== mb) return ma ? 1 : -1;
      if (!ma && pa !== pb) return (pa < pb ? -1 : 1) * pSign;
      const sa = sv[a];
      const sb = sv[b];
      const sa2 = isMissingNumeric(sa);
      const sb2 = isMissingNumeric(sb);
      if (sa2 !== sb2) return sa2 ? 1 : -1;
      if (!sa2 && sa !== sb) return sa < sb ? -sSign : sSign;
      return 0;
    };
  }
  if (s && s.kind === 'str') {
    const sv = s.values;
    return (a, b) => {
      const pa = pv[a] ?? MISSING_TEXT;
      const pb = pv[b] ?? MISSING_TEXT;
      const ma = pa === MISSING_TEXT;
      const mb = pb === MISSING_TEXT;
      if (ma !== mb) return ma ? 1 : -1;
      if (!ma && pa !== pb) return (pa < pb ? -1 : 1) * pSign;
      const sa = sv[a] ?? MISSING_TEXT;
      const sb = sv[b] ?? MISSING_TEXT;
      if (sa !== sb) return (sa < sb ? -1 : 1) * sSign;
      return 0;
    };
  }
  return (a, b) => {
    const pa = pv[a] ?? MISSING_TEXT;
    const pb = pv[b] ?? MISSING_TEXT;
    const ma = pa === MISSING_TEXT;
    const mb = pb === MISSING_TEXT;
    if (ma !== mb) return ma ? 1 : -1;
    if (!ma && pa !== pb) return (pa < pb ? -1 : 1) * pSign;
    return 0;
  };
}

/** Ranks used by the severity key; higher is more severe. */
export const SEVERITY_RANK: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  notice: 3,
  warn: 4,
  warning: 4,
  error: 5,
  err: 5,
  critical: 6,
  crit: 6,
  fatal: 7,
  emergency: 8,
};

export function severityRank(label: string): number {
  return SEVERITY_RANK[label.toLowerCase()] ?? -1;
}
