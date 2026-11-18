/**
 * Log reader: splits a log file into *records* (not lines) and extracts a
 * timestamp, a severity and a source from each one.
 *
 * Supported timestamp shapes: ISO-8601 (with or without zone), the
 * nginx/Apache common-log bracket format, and `YYYY-MM-DD HH:MM:SS`.
 * Anything else keeps `time = NaN` and is still parsed, counted and sorted
 * (missing keys sort last, deterministically).
 *
 * @module parse/log
 */

import type { LogRecord, ParseWarning } from './types.ts';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const ISO_RE =
  /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?)(Z|[+-]\d{2}:?\d{2})?/;
const CLF_RE = /\[(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})\]/;
const SEVERITY_RE =
  /\b(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|ERR|CRITICAL|CRIT|FATAL|EMERGENCY|EMERG)\b/;
const SOURCE_RE = /\[([A-Za-z0-9_.\-/]{2,40})\]/;

/** Normalises a severity token to a single canonical label. */
function normaliseSeverity(token: string): string {
  const up = token.toUpperCase();
  if (up === 'WARNING') return 'WARN';
  if (up === 'ERR') return 'ERROR';
  if (up === 'CRIT') return 'CRITICAL';
  if (up === 'EMERG') return 'EMERGENCY';
  return up;
}

/**
 * Pulls timestamp / severity / source out of one physical line.
 * Returns `time: NaN` when no timestamp pattern matches.
 */
export function extractLogMeta(line: string): {
  time: number;
  severity: string;
  source: string;
  hasTimestamp: boolean;
} {
  let time = NaN;
  let hasTimestamp = false;

  const iso = ISO_RE.exec(line);
  if (iso) {
    const [, date, clock, zone] = iso;
    const normClock = clock.replace(',', '.');
    const zonePart = zone ? (zone === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : '';
    const parsed = Date.parse(`${date}T${normClock}${zonePart}`);
    if (!Number.isNaN(parsed)) {
      time = parsed;
      hasTimestamp = true;
    }
  }

  if (!hasTimestamp) {
    const clf = CLF_RE.exec(line);
    if (clf) {
      const [, dd, mon, yyyy, hms, tz] = clf;
      const mm = MONTHS[mon.toLowerCase()];
      if (mm) {
        const zone = tz.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
        const parsed = Date.parse(`${yyyy}-${mm}-${dd}T${hms}${zone}`);
        if (!Number.isNaN(parsed)) {
          time = parsed;
          hasTimestamp = true;
        }
      }
    }
  }

  const sevMatch = SEVERITY_RE.exec(line);
  const severity = sevMatch ? normaliseSeverity(sevMatch[1]) : '';

  const srcMatch = SOURCE_RE.exec(line);
  // Fallback: the leading token of a common-log line is the client address.
  const leading = /^\s*([A-Za-z0-9_.:-]{2,45})\s/.exec(line);
  const source = srcMatch ? srcMatch[1] : leading ? leading[1] : '';

  return { time, severity, source, hasTimestamp };
}

/** True when a line looks like the start of a new record rather than a continuation. */
function startsRecord(line: string): boolean {
  if (line.trim() === '') return false;
  if (ISO_RE.test(line) || CLF_RE.test(line)) return true;
  // A leading severity/level token also starts a record in many app logs.
  return /^\s*(?:\[?\d{4}-\d{2}-\d{2}|[A-Z]{4,9}\b)/.test(line) || /^\s*\[?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/.test(line);
}

/**
 * Turns raw log text into records, attaching continuation lines (stack traces,
 * indented context) to the record that started them.
 */
export function buildLogRecords(text: string): {
  records: LogRecord[];
  warnings: ParseWarning[];
} {
  const records: LogRecord[] = [];
  const warnings: ParseWarning[] = [];
  const lines = text.split(/\r?\n/);

  let current: LogRecord | null = null;

  const push = (): void => {
    if (current && current.raw.trim() !== '') records.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (line.trim() === '') {
      if (current) current.raw += '\n';
      continue;
    }

    if (!current || startsRecord(line)) {
      push();
      const meta = extractLogMeta(line);
      const message = line
        .replace(ISO_RE, '')
        .replace(CLF_RE, '')
        .replace(SEVERITY_RE, '')
        .trim();
      current = {
        id: records.length,
        raw: line,
        time: meta.time,
        severity: meta.severity,
        source: meta.source,
        message: message === '' ? line.trim() : message,
        cells: [],
        line: lineNo,
      };
      continue;
    }

    // Continuation line — belongs to the record above it.
    current.raw += `\n${line}`;
    current.message += `\n${line.trim()}`;
    if (!current.severity) {
      const meta = extractLogMeta(line);
      if (meta.severity) current.severity = meta.severity;
    }
  }
  push();

  const missingTime = records.filter((r) => Number.isNaN(r.time)).length;
  if (missingTime > 0) {
    warnings.push({
      line: 0,
      reason: `${missingTime} record(s) have no recognisable timestamp; they sort last and keep file order.`,
    });
  }

  return { records, warnings };
}
