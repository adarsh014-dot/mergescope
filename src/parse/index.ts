/**
 * Format detection and record construction.
 *
 * @module parse/index
 */

import { parseCsv, splitHeader } from './csv.ts';
import { buildLogRecords, extractLogMeta } from './log.ts';
import { LOG_COLUMNS } from './types.ts';
import type { LogRecord, ParseWarning, ParsedData } from './types.ts';
import type { KeySeries, KeyKind } from '../core/keys.ts';
import { severityRank } from '../core/keys.ts';

export type { LogRecord, ParseWarning, ParsedData } from './types.ts';
export { LOG_COLUMNS } from './types.ts';

/** Column identifiers the key selector understands. */
export type KeyId = string; // 'time' | 'severity' | 'source' | 'message' | 'line' | 'raw' | `col:${string}`

function looksLikeCsv(text: string): boolean {
  const lines = text.split(/\r?\n/, 25).filter((l) => l.trim() !== '');
  if (lines.length < 2) return false;
  const counts = lines.slice(0, 10).map((l) => (l.match(/,/g) ?? []).length);
  const usable = counts.filter((c) => c >= 2);
  return usable.length >= Math.min(3, lines.length);
}

/** Chooses a reader based on file name first, then content. */
export function detectKind(fileName: string, text: string): 'log' | 'csv' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return 'csv';
  if (lower.endsWith('.log')) return 'log';
  return looksLikeCsv(text) ? 'csv' : 'log';
}

function inferNumeric(values: string[]): boolean {
  const sample = values.slice(0, 200).filter((v) => v.trim() !== '');
  if (sample.length === 0) return false;
  let numeric = 0;
  for (const v of sample) {
    const n = Number(v);
    if (Number.isFinite(n)) numeric++;
    else if (!Number.isNaN(Date.parse(v))) numeric++;
  }
  return numeric / sample.length >= 0.8;
}

function timeFromCell(value: string): number {
  const n = Number(value);
  if (Number.isFinite(n) && value.trim() !== '' && Math.abs(n) > 1e11) return n; // already epoch ms
  if (Number.isFinite(n) && value.trim() !== '') return n;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

const TIME_HINT = /(time|date|stamp|ts|at|created)/i;
const SEVERITY_HINT = /(severity|level|lvl|priority|status_code|levelname)/i;
const MESSAGE_HINT = /(message|msg|text|detail|event|description|line)/i;
const SOURCE_HINT = /(host|service|source|logger|app|server|ip|client|user)/i;

/** Parses a CSV file into records, keeping every row even if it is ragged. */
export function parseCsvData(text: string): ParsedData {
  const { rows, warnings, delimiter } = parseCsv(text);
  const { header, body } = splitHeader(rows);
  const parseWarnings: ParseWarning[] = warnings.map((reason) => ({ line: 0, reason }));

  const colIndex = (hint: RegExp): number => header.findIndex((h) => hint.test(h));

  const timeCol = TIME_HINT.test(header.join(' ')) ? colIndex(TIME_HINT) : -1;
  const sevCol = colIndex(SEVERITY_HINT);
  const msgCol = colIndex(MESSAGE_HINT);
  const srcCol = colIndex(SOURCE_HINT);

  let irregular = 0;
  const records: LogRecord[] = body.map((cells, i) => {
    if (cells.length !== header.length) irregular++;
    const cell = (idx: number): string => (idx >= 0 && idx < cells.length ? (cells[idx] ?? '').trim() : '');
    const time = timeCol >= 0 ? timeFromCell(cell(timeCol)) : NaN;
    const severity = sevCol >= 0 ? cell(sevCol).toUpperCase() : '';
    return {
      id: i,
      raw: cells.join(', '),
      time,
      severity,
      source: srcCol >= 0 ? cell(srcCol) : '',
      message: msgCol >= 0 ? cell(msgCol) : cell(0),
      cells,
      line: i + 2,
    };
  });

  if (irregular > 0) {
    parseWarnings.push({
      line: 0,
      reason: `${irregular} row(s) had a different number of cells than the header; kept as-is with blanks.`,
    });
  }

  return {
    kind: 'csv',
    records,
    columns: header,
    warnings: parseWarnings,
    bytes: text.length,
    delimiter,
  };
}

/** Parses a log file into records (multi-line events kept together). */
export function parseLogData(text: string): ParsedData {
  const { records, warnings } = buildLogRecords(text);
  return {
    kind: 'log',
    records,
    columns: [...LOG_COLUMNS],
    warnings,
    bytes: text.length,
  };
}

/** Detects the format and parses in one step. */
export function parseFile(fileName: string, text: string): ParsedData {
  return detectKind(fileName, text) === 'csv' ? parseCsvData(text) : parseLogData(text);
}

export interface KeyOption {
  id: KeyId;
  label: string;
  kind: KeyKind;
  hint: string;
}

/** The list of sort keys offered for a parsed dataset. */
export function keyOptions(data: ParsedData): KeyOption[] {
  if (data.kind === 'csv') {
    const options: KeyOption[] = data.columns.map((col, idx) => {
      const values = data.records.slice(0, 200).map((r) => r.cells[idx] ?? '');
      const numeric = inferNumeric(values);
      return {
        id: `col:${col}`,
        label: col,
        kind: numeric ? 'num' : 'str',
        hint: `column ${idx + 1} · ${numeric ? 'numeric' : 'text'}`,
      };
    });
    return options;
  }
  return [
    { id: 'time', label: 'timestamp', kind: 'num', hint: 'parsed from each record' },
    { id: 'severity', label: 'severity', kind: 'num', hint: 'rank: TRACE < … < EMERGENCY' },
    { id: 'source', label: 'source', kind: 'str', hint: 'host / logger' },
    { id: 'message', label: 'message', kind: 'str', hint: 'record body' },
    { id: 'line', label: 'file position', kind: 'num', hint: 'original line order' },
  ];
}

/** Default key choice for a freshly loaded dataset. */
export function defaultKey(data: ParsedData): KeyId {
  if (data.kind === 'csv') {
    const idx = data.columns.findIndex((c) => TIME_HINT.test(c));
    return `col:${data.columns[idx >= 0 ? idx : 0]}`;
  }
  return 'time';
}

function cellFor(record: LogRecord, columnId: string, data: ParsedData): string {
  const idx = data.columns.indexOf(columnId);
  return idx >= 0 ? (record.cells[idx] ?? '') : '';
}

/** Projects one key column of the dataset into a compact series for the sorter. */
export function buildKeySeries(data: ParsedData, keyId: KeyId): KeySeries {
  const n = data.records.length;

  if (keyId === 'time') {
    const values = new Float64Array(n);
    for (let i = 0; i < n; i++) values[i] = data.records[i].time;
    return { kind: 'num', values };
  }
  if (keyId === 'severity') {
    const values = new Float64Array(n);
    for (let i = 0; i < n; i++) values[i] = severityRank(data.records[i].severity);
    return { kind: 'num', values };
  }
  if (keyId === 'line') {
    const values = new Float64Array(n);
    for (let i = 0; i < n; i++) values[i] = data.records[i].line;
    return { kind: 'num', values };
  }
  if (keyId === 'source') {
    return { kind: 'str', values: data.records.map((r) => r.source) };
  }
  if (keyId === 'message' || keyId === 'raw') {
    return { kind: 'str', values: data.records.map((r) => r.message) };
  }

  const columnId = keyId.startsWith('col:') ? keyId.slice(4) : keyId;
  const idx = data.columns.indexOf(columnId);
  const raw = data.records.map((r) => (idx >= 0 ? (r.cells[idx] ?? '') : ''));

  if (inferNumeric(raw)) {
    const values = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const v = raw[i];
      const num = Number(v);
      values[i] = Number.isFinite(num) && v.trim() !== '' ? num : Date.parse(v);
    }
    return { kind: 'num', values };
  }
  return { kind: 'str', values: raw };
}

export { extractLogMeta, cellFor };
