#!/usr/bin/env node
/**
 * MergeScope CLI — the same instrumented merge sort, without a browser.
 *
 * Usage:
 *   node cli/index.ts access.log --key time --limit 10
 *   node cli/index.ts transactions.csv --key col:amount --order desc
 *   node cli/index.ts app.log --key severity --then time --json
 *
 * Node 22.18+ / 23+ runs this TypeScript directly (type stripping), so the CLI
 * has zero dependencies and shares the exact sorter the website uses.
 *
 * @module cli
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { buildKeySeries, keyOptions, parseFile } from '../src/parse/index.ts';
import type { KeyId } from '../src/parse/index.ts';
import { buildComparator } from '../src/core/keys.ts';
import type { SortKeySpec } from '../src/core/keys.ts';
import { mergeSortIndices } from '../src/core/mergesort.ts';
import { buildCsv } from '../src/lib/export.ts';
import { formatInt, formatMs, formatTimestamp } from '../src/lib/format.ts';

interface Args {
  file?: string;
  key?: string;
  then?: string;
  order: 'asc' | 'desc';
  limit: number;
  json: boolean;
  out?: string;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { order: 'asc', limit: 8, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--key':
        args.key = argv[++i];
        break;
      case '--then':
        args.then = argv[++i];
        break;
      case '--order':
        args.order = argv[++i] === 'desc' ? 'desc' : 'asc';
        break;
      case '--limit':
        args.limit = Number(argv[++i] ?? 8);
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--json':
        args.json = true;
        break;
      default:
        if (!token.startsWith('-') && !args.file) args.file = token;
    }
  }
  return args;
}

const HELP = `
MergeScope — sort log and CSV files with a hand-written, instrumented merge sort.

  node cli/index.ts <file> [options]

Options
  --key <id>       primary sort key (default: timestamp, or the first CSV column)
  --then <id>      secondary sort key (tie-breaker; stability makes this safe)
  --order asc|desc sort direction (default: asc)
  --limit <n>      rows to print (default: 8)
  --out <path>     write the sorted file
  --json           print the metrics report as JSON instead of a table
  -h, --help       this message

Keys
  logs: time, severity, source, message, line
  csv:  col:<column-name>

Examples
  node cli/index.ts access.log --key time --limit 10
  node cli/index.ts app.log --key severity --then time
  node cli/index.ts transactions.csv --key col:amount --order desc --json
  node cli/index.ts access.log --key time --out sorted.log
`.trim();

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.file) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  let text: string;
  try {
    text = readFileSync(args.file, 'utf8');
  } catch (error) {
    console.error(`Cannot read "${args.file}": ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  const data = parseFile(basename(args.file), text);
  if (data.records.length === 0) {
    console.error('No records found in that file.');
    process.exit(1);
  }

  const options = keyOptions(data);
  const defaultKey: KeyId = data.kind === 'csv' ? options[0].id : 'time';
  const primaryId = (args.key ?? defaultKey) as KeyId;

  if (!options.some((o) => o.id === primaryId)) {
    console.error(`Unknown key "${primaryId}". Available: ${options.map((o) => o.id).join(', ')}`);
    process.exit(1);
  }

  const spec: SortKeySpec = {
    primary: buildKeySeries(data, primaryId),
    primaryOrder: args.order,
    secondary: args.then ? buildKeySeries(data, args.then as KeyId) : undefined,
    secondaryOrder: 'asc',
  };

  const result = mergeSortIndices(data.records.length, buildComparator(spec), {});
  const { metrics } = result;
  const n = data.records.length;
  const expectedDepth = n > 1 ? Math.ceil(Math.log2(n)) : 0;

  if (args.out) {
    const rows = Array.from(result.order, (i) => data.records[i]);
    const outputText =
      data.kind === 'csv'
        ? buildCsv(rows, data.columns, data.delimiter ?? ',')
        : rows.map((r) => r.raw).join('\n');
    writeFileSync(args.out, outputText, 'utf8');
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          tool: 'MergeScope CLI',
          file: args.file,
          kind: data.kind,
          records: n,
          primaryKey: primaryId,
          secondaryKey: args.then ?? null,
          order: args.order,
          measured: {
            comparisons: metrics.comparisons,
            moves: metrics.moves,
            recursiveCalls: metrics.recursiveCalls,
            maxDepth: metrics.maxDepth,
            elapsedMs: Number(metrics.elapsedMs.toFixed(3)),
            peakAuxElements: metrics.peakAuxElements,
          },
          theory: {
            recurrence: 'T(n) = 2T(n/2) + Θ(n) = Θ(n log n)',
            expectedDepth,
            depthMatchesTheory: metrics.maxDepth === expectedDepth,
            stable: true,
          },
          warnings: data.warnings,
        },
        null,
        2,
      ),
    );
    return;
  }

  const line = '─'.repeat(72);
  console.log(`\nMergeScope  ${args.file}`);
  console.log(line);
  console.log(
    `  ${formatInt(n)} ${data.kind === 'csv' ? 'CSV rows' : 'log records'} · key ${primaryId}` +
      `${args.then ? ` → ${args.then}` : ''} · ${args.order}ending`,
  );
  console.log(
    `  comparisons ${formatInt(metrics.comparisons)} · moves ${formatInt(metrics.moves)} · ` +
      `depth ${metrics.maxDepth} (theory ⌈log₂n⌉ = ${expectedDepth}) · ${formatMs(metrics.elapsedMs)}`,
  );
  console.log(
    `  auxiliary buffer ${formatInt(metrics.peakAuxElements)} elements · Θ(n) space · stable`,
  );
  if (data.warnings.length > 0) {
    for (const warning of data.warnings.slice(0, 3)) console.log(`  ! ${warning.reason}`);
  }
  console.log(line);

  if (data.kind === 'csv') {
    console.log(`  ${pad('#', 5)}${pad('timestamp', 25)}${pad('severity', 9)}${pad('source', 16)}message`);
  } else {
    console.log(`  ${pad('#', 5)}${pad('timestamp', 25)}${pad('severity', 9)}${pad('source', 16)}message`);
  }

  const limit = Math.min(args.limit, n);
  for (let i = 0; i < limit; i++) {
    const record = data.records[result.order[i]];
    const message = record.message.replace(/\s+/g, ' ').slice(0, 46);
    console.log(
      `  ${pad(String(i + 1), 5)}${pad(formatTimestamp(record.time), 25)}` +
        `${pad(record.severity || '—', 9)}${pad(record.source || '—', 16)}${message}`,
    );
  }
  if (n > limit) console.log(`  … ${formatInt(n - limit)} more records`);
  if (args.out) console.log(`\n  written → ${args.out}`);
  console.log();
}

main();
