/**
 * A small RFC-4180-style CSV reader, written in-repo so the project owns its
 * parsing edge cases (quoted commas, escaped quotes, embedded newlines, CRLF,
 * BOM, ragged rows).
 *
 * @module parse/csv
 */

export interface CsvParseResult {
  rows: string[][];
  /** Non-fatal problems, one human-readable line each. */
  warnings: string[];
  delimiter: string;
}

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;

/** Picks the delimiter that appears most often outside quotes on the first line. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, 4000).split(/\r?\n/, 1)[0] ?? '';
  let best: string = ',';
  let bestCount = -1;
  for (const candidate of DELIMITER_CANDIDATES) {
    let inQuotes = false;
    let count = 0;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === candidate && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/**
 * Parses CSV text into rows of cells.
 * Malformed quotes are tolerated: the cell simply runs to the end of input and
 * a warning is recorded, rather than throwing and losing the user's file.
 */
export function parseCsv(text: string): CsvParseResult {
  const warnings: string[] = [];
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1); // strip BOM

  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let lineNo = 1;

  const pushCell = (): void => {
    row.push(cell);
    cell = '';
  };
  const pushRow = (): void => {
    pushCell();
    // Ignore fully-empty trailing lines.
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') lineNo++;
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (cell.trim() !== '') {
        // A bare quote inside an unquoted cell: keep it literal.
        cell += ch;
      } else {
        inQuotes = true;
        cell = '';
      }
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      continue;
    }

    if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      pushRow();
      lineNo++;
      continue;
    }

    if (ch === '\n') {
      pushRow();
      lineNo++;
      continue;
    }

    cell += ch;
  }

  if (inQuotes) {
    warnings.push(`Unterminated quoted field near line ${lineNo}; kept the remaining text as one cell.`);
  }
  if (cell !== '' || row.length > 0) pushRow();

  return { rows, warnings, delimiter };
}

/** Maps a parsed CSV into header + body, tolerating a missing header row. */
export function splitHeader(rows: string[][]): { header: string[]; body: string[][] } {
  if (rows.length === 0) return { header: [], body: [] };
  const first = rows[0];
  const looksLikeHeader = first.some((c) => c.trim() !== '' && Number.isNaN(Number(c)));
  if (!looksLikeHeader) {
    return { header: first.map((_, i) => `col_${i + 1}`), body: rows };
  }
  return { header: first.map((h, i) => h.trim() || `col_${i + 1}`), body: rows.slice(1) };
}
