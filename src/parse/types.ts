/**
 * Record model shared by the log and CSV readers.
 *
 * A "record" is a unit the user thinks of as one row — for logs that is often
 * several physical lines (a stack trace belongs to the ERROR above it). Keeping
 * multi-line events glued together is the whole reason this tool exists: a naive
 * line sorter shreds them.
 *
 * @module parse/types
 */

export interface LogRecord {
  /** Position in the original file, 0-based. Never changes. */
  id: number;
  /** Full text of the record, including continuation lines. */
  raw: string;
  /** Epoch milliseconds, or NaN when no timestamp could be parsed. */
  time: number;
  /** Normalised severity label (uppercase), or '' when none was found. */
  severity: string;
  /** Host / logger / service, or ''. */
  source: string;
  /** Human-facing text: the message body, or the first non-parsed token. */
  message: string;
  /** CSV cells when the input was CSV; empty for logs. */
  cells: string[];
  /** 1-based line number where the record starts. */
  line: number;
}

export interface ParseWarning {
  line: number;
  reason: string;
}

export interface ParsedData {
  kind: 'log' | 'csv';
  records: LogRecord[];
  /** CSV header, or the synthetic columns used for log files. */
  columns: string[];
  warnings: ParseWarning[];
  bytes: number;
  /** Delimiter used, for CSV files. */
  delimiter?: string;
}

export const LOG_COLUMNS = ['time', 'severity', 'source', 'message'] as const;
