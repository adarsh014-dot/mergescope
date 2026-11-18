/**
 * Parser tests — the edge cases that decide whether the tool survives a real
 * file, and whether "records" means records rather than lines.
 */

import { describe, expect, it } from 'vitest';

import { parseCsv, splitHeader } from '../src/parse/csv.ts';
import { buildLogRecords, extractLogMeta } from '../src/parse/log.ts';
import { buildKeySeries, detectKind, keyOptions, parseFile } from '../src/parse/index.ts';

describe('csv parser', () => {
  it('parses quoted fields containing delimiters', () => {
    const { rows } = parseCsv('a,b\n"x,y",2');
    expect(rows[1]).toEqual(['x,y', '2']);
  });

  it('parses escaped quotes', () => {
    const { rows } = parseCsv('a\n"say ""hi"""');
    expect(rows[1]).toEqual(['say "hi"']);
  });

  it('parses a newline inside a quoted field', () => {
    const { rows } = parseCsv('a,b\n"line1\nline2",2');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('line1\nline2');
  });

  it('handles CRLF and a BOM', () => {
    const { rows } = parseCsv('\ufeffa,b\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('detects a semicolon delimiter', () => {
    const { rows, delimiter } = parseCsv('a;b;c\n1;2;3');
    expect(delimiter).toBe(';');
    expect(rows[1]).toEqual(['1', '2', '3']);
  });

  it('keeps ragged rows instead of dropping them', () => {
    const { rows } = parseCsv('a,b\n1,2,3\n4');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['1', '2', '3']);
    expect(rows[2]).toEqual(['4']);
  });

  it('returns nothing for an empty file', () => {
    expect(parseCsv('').rows).toEqual([]);
  });

  it('tolerates an unterminated quote with a warning', () => {
    const { rows, warnings } = parseCsv('a,b\n"unterminated,2');
    expect(rows).toHaveLength(2);
    expect(warnings.length).toBe(1);
  });

  it('synthesises column names when there is no header', () => {
    const { header } = splitHeader([
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(header).toEqual(['col_1', 'col_2']);
  });
});

describe('log parser', () => {
  it('parses an ISO timestamp, severity and source', () => {
    const meta = extractLogMeta('2024-05-01T09:00:03.250Z [billing] ERROR charge failed');
    expect(meta.hasTimestamp).toBe(true);
    expect(meta.time).toBe(Date.parse('2024-05-01T09:00:03.250Z'));
    expect(meta.severity).toBe('ERROR');
    expect(meta.source).toBe('billing');
  });

  it('parses the nginx common-log timestamp', () => {
    const line =
      '10.0.4.11 - u_1 [01/May/2024:13:55:36 +0000] "GET /healthz HTTP/1.1" 200 512 "-" "curl"';
    const meta = extractLogMeta(line);
    expect(meta.time).toBe(Date.parse('2024-05-01T13:55:36Z'));
    expect(meta.source).toBe('10.0.4.11');
  });

  it('groups continuation lines into one record', () => {
    const text = [
      '2024-05-01T09:00:03Z [billing] ERROR charge failed',
      '    at OrderService.reserve (service.ts:214)',
      '    caused by: ECONNRESET',
      '2024-05-01T09:00:04Z [billing] INFO recovered',
    ].join('\n');
    const { records } = buildLogRecords(text);
    expect(records).toHaveLength(2);
    expect(records[0].raw).toContain('ECONNRESET');
    expect(records[0].raw.split('\n')).toHaveLength(3);
    expect(records[1].severity).toBe('INFO');
  });

  it('keeps a timestamp-less file as records without inventing times', () => {
    const { records, warnings } = buildLogRecords('hello\nworld');
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => Number.isNaN(r.time))).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('handles an empty file', () => {
    const { records } = buildLogRecords('');
    expect(records).toEqual([]);
  });
});

describe('format detection and keys', () => {
  it('detects a csv by extension', () => {
    expect(detectKind('data.csv', 'a,b\n1,2')).toBe('csv');
    expect(detectKind('data.log', 'a,b\n1,2')).toBe('log');
  });

  it('sniffs csv content for unknown extensions', () => {
    expect(detectKind('data.txt', 'a,b,c\n1,2,3\n4,5,6\n7,8,9')).toBe('csv');
  });

  it('builds numeric time series from a parsed log', () => {
    const parsed = parseFile('x.log', '2024-05-01T09:00:00Z INFO a\n2024-05-01T09:00:01Z INFO b');
    const series = buildKeySeries(parsed, 'time');
    expect(series.kind).toBe('num');
    if (series.kind === 'num') {
      expect(series.values[1] - series.values[0]).toBe(1000);
    }
  });

  it('exposes csv columns as key options', () => {
    const parsed = parseFile('x.csv', 'id,amount\n1,10.5\n2,3.25');
    const options = keyOptions(parsed);
    expect(options.map((o) => o.id)).toEqual(['col:id', 'col:amount']);
    const amount = buildKeySeries(parsed, 'col:amount');
    expect(amount.kind).toBe('num');
  });

  it('ranks severities numerically', () => {
    const parsed = parseFile('x.log', '2024-05-01T09:00:00Z ERROR a\n2024-05-01T09:00:00Z DEBUG b');
    const series = buildKeySeries(parsed, 'severity');
    expect(series.kind).toBe('num');
    if (series.kind === 'num') {
      expect(series.values[0]).toBeGreaterThan(series.values[1]);
    }
  });
});
