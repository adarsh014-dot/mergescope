/**
 * Download helpers: rebuild the user's file in sorted order and produce an
 * honest metrics report next to it.
 *
 * @module lib/export
 */

import type { ParsedData, LogRecord } from '../parse/types.ts';
import type { SortResult } from '../core/types.ts';
import type { SortKeySpec } from '../core/keys.ts';

function csvCell(value: string, delimiter: string): string {
  const needsQuotes = value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Rebuilds CSV text from records in the given order. */
export function buildCsv(rows: LogRecord[], columns: string[], delimiter = ','): string {
  const lines: string[] = [columns.map((c) => csvCell(c, delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(columns.map((_, i) => csvCell(row.cells[i] ?? '', delimiter)).join(delimiter));
  }
  return lines.join('\r\n');
}

/** Rebuilds log text, keeping multi-line records intact. */
export function buildLog(rows: LogRecord[]): string {
  return rows.join('\n');
}

/** Rebuilds the original file format from the parsed data and a permutation. */
export function rebuildFile(data: ParsedData, order: Int32Array): string {
  const rows = Array.from(order, (i) => data.records[i]);
  return data.kind === 'csv'
    ? buildCsv(rows, data.columns, data.delimiter ?? ',')
    : buildLog(rows);
}

export function download(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A metrics document that can be attached to the report or shown in a viva. */
export function buildReport(
  fileName: string,
  data: ParsedData,
  spec: SortKeySpec,
  result: SortResult,
): string {
  const { metrics, levels } = result;
  const n = data.records.length;
  const log2n = n > 1 ? Math.ceil(Math.log2(n)) : 0;
  const report = {
    tool: 'MergeScope',
    algorithm: 'top-down merge sort (hand-written, instrumented)',
    generatedAt: new Date().toISOString(),
    input: {
      fileName,
      kind: data.kind,
      records: n,
      bytes: data.bytes,
      columns: data.columns,
      parseWarnings: data.warnings,
    },
    sort: {
      primaryKey:
        spec.primary.kind === 'num' ? `${spec.primaryOrder} numeric` : `${spec.primaryOrder} text`,
      secondaryKey: spec.secondary
        ? spec.secondary.kind === 'num'
          ? `${spec.secondaryOrder ?? 'asc'} numeric`
          : `${spec.secondaryOrder ?? 'asc'} text`
        : null,
    },
    measured: {
      comparisons: metrics.comparisons,
      moves: metrics.moves,
      recursiveCalls: metrics.recursiveCalls,
      maxDepth: metrics.maxDepth,
      levels: metrics.levels,
      elapsedMs: Number(metrics.elapsedMs.toFixed(3)),
      peakAuxElements: metrics.peakAuxElements,
    },
    theory: {
      recurrence: 'T(n) = 2T(n/2) + Θ(n)  ⇒  T(n) = Θ(n log n)',
      expectedDepth: log2n,
      depthMatchesTheory: metrics.maxDepth === log2n || n <= 1,
      comparisonUpperBound: n <= 1 ? 0 : n * log2n,
      withinUpperBound: metrics.comparisons <= (n <= 1 ? 0 : n * log2n),
      space: 'Θ(n) auxiliary array + Θ(log n) call stack',
      stable: true,
    },
    levels,
  };
  return JSON.stringify(report, null, 2);
}

/** Metrics as a small CSV table, one row per recursion level. */
export function buildLevelsCsv(result: SortResult): string {
  const header = 'depth,nodes,elements,comparisons';
  const rows = result.levels.map(
    (l) => `${l.depth},${l.nodes},${l.elements},${l.comparisons}`,
  );
  return [header, ...rows].join('\n');
}
