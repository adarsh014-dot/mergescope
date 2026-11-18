/**
 * Deterministic sample datasets.
 *
 * Everything here is synthetic and seeded, so demos are reproducible: the same
 * seed always produces byte-identical input, which matters when you are
 * comparing measured comparison counts during a viva.
 *
 * @module data/samples
 */

import incidentLogText from '../../sample-data/incident-2024-05-01.log?raw';

/** mulberry32 — small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICES = ['api-gateway', 'auth-service', 'billing', 'ingest-worker', 'scheduler'];
const SEVERITIES = ['DEBUG', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR'] as const;
const PATHS = ['/v1/orders', '/v1/orders/42', '/healthz', '/v1/users', '/v1/search', '/static/app.js'];
const METHODS = ['GET', 'GET', 'POST', 'PATCH', 'DELETE'];
const HOSTS = ['10.0.4.11', '10.0.4.12', '10.0.9.3', '10.0.9.4', '172.16.0.8'];
const USERS = ['u_1041', 'u_2210', 'u_3390', 'u_4102', 'u_5518'];
const QUERIES = ['sort=recent', 'page=2', 'q=invoice', 'limit=50', 'debug=1'];

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function isoAt(baseMs: number, offsetMs: number): string {
  const d = new Date(baseMs + offsetMs);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds(), 3)}Z`
  );
}

function clfAt(baseMs: number, offsetMs: number): string {
  const d = new Date(baseMs + offsetMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    `${pad(d.getUTCDate())}/${months[d.getUTCMonth()]}/${d.getUTCFullYear()}:` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`
  );
}

/** nginx-style access log lines. Timestamps deliberately out of order. */
export function makeAccessLog(count = 1800, seed = 20240501): string {
  const rnd = mulberry32(seed);
  const base = Date.UTC(2024, 4, 1, 9, 0, 0);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.floor(rnd() * 6 * 3600 * 1000);
    const status = rnd() < 0.9 ? 200 : rnd() < 0.6 ? 404 : 500;
    lines.push(
      `${HOSTS[Math.floor(rnd() * HOSTS.length)]} - ${USERS[Math.floor(rnd() * USERS.length)]} ` +
        `[${clfAt(base, offset)}] "${METHODS[Math.floor(rnd() * METHODS.length)]} ` +
        `${PATHS[Math.floor(rnd() * PATHS.length)]}?${QUERIES[Math.floor(rnd() * QUERIES.length)]} HTTP/1.1" ` +
        `${status} ${Math.floor(rnd() * 9000) + 120} "-" "Mozilla/5.0 (compatible; MergeScopeDemo/1.0)"`,
    );
  }
  return lines.join('\n');
}

/** Application log with multi-line stack traces glued to their ERROR record. */
export function makeAppLog(count = 900, seed = 77123): string {
  const rnd = mulberry32(seed);
  const base = Date.UTC(2024, 4, 1, 11, 30, 0);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.floor(rnd() * 4 * 3600 * 1000);
    const sev = SEVERITIES[Math.floor(rnd() * SEVERITIES.length)];
    const svc = SERVICES[Math.floor(rnd() * SERVICES.length)];
    out.push(
      `${isoAt(base, offset)} [${svc}] ${sev} request=${Math.floor(rnd() * 1e6)} ` +
        `user=${USERS[Math.floor(rnd() * USERS.length)]} ${rnd() < 0.5 ? 'handled' : 'retrying upstream'}`,
    );
    if (sev === 'ERROR' && rnd() < 0.7) {
      out.push('    at OrderService.reserve (src/orders/service.ts:214:19)');
      out.push('    at BillingClient.charge (src/billing/client.ts:88:11)');
      out.push(`    caused by: ECONNRESET upstream=${SERVICES[Math.floor(rnd() * SERVICES.length)]}`);
    }
    if (sev === 'WARN' && rnd() < 0.4) {
      out.push('    pool utilisation 0.91 — consider raising max_connections');
    }
  }
  return out.join('\n');
}

/** Transactions CSV: a numeric column, a timestamp column, duplicate timestamps. */
export function makeTransactionsCsv(count = 1400, seed = 99991): string {
  const rnd = mulberry32(seed);
  const base = Date.UTC(2024, 4, 1, 8, 0, 0);
  const statuses = ['settled', 'pending', 'failed', 'refunded'];
  const rows: string[] = ['id,timestamp,severity,service,amount,currency,status,message'];
  for (let i = 0; i < count; i++) {
    // Duplicate timestamps are intentional: they exercise stability.
    const offset = Math.floor(rnd() * 3 * 3600 * 1000);
    const amount = (rnd() * 4800 + 1).toFixed(2);
    const sev = SEVERITIES[Math.floor(rnd() * SEVERITIES.length)];
    rows.push(
      [
        `tx_${100000 + i}`,
        isoAt(base, offset),
        sev,
        SERVICES[Math.floor(rnd() * SERVICES.length)],
        amount,
        'USD',
        statuses[Math.floor(rnd() * statuses.length)],
        `payment ${rnd() < 0.5 ? 'captured' : 'authorised'} for order ${Math.floor(rnd() * 90000)}`,
      ].join(','),
    );
  }
  return rows.join('\n');
}

/**
 * A deliberately hostile CSV: BOM, CRLF, quoted delimiters, an embedded newline,
 * a ragged row, emoji/CJK text, empty keys and a stray quote.
 */
export function makeHostileCsv(): string {
  return [
    '\ufeffid,timestamp,severity,service,amount,note',
    '1,2024-05-01T09:00:03Z,INFO,ingest,12.50,"retry, then success"',
    '2,2024-05-01T09:00:01Z,WARN,billing,0.00,"line one\nline two"',
    '3,2024-05-01T09:00:01Z,ERROR,billing,44.10,"quoted ""inner"" quotes"',
    '4,2024-05-01T09:00:02Z,,auth,7.00,missing severity',
    '5,,,,,empty key row',
    '6,2024-05-01T09:00:01Z,INFO,api,3.30,"emoji 🧪 and 日本語 text"',
    '7,2024-05-01T09:00:00Z,DEBUG,api,1.10,ragged-row-extra-cell,unexpected',
    '8,2024-05-01T09:00:05Z,INFO,api,9.99,ok',
  ].join('\r\n');
}

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  fileName: string;
  make: () => string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'incident',
    name: 'incident log (demo)',
    description: '512 records · 12-minute outage · stack traces, duplicate millis',
    fileName: 'incident-2024-05-01.log',
    make: () => incidentLogText,
  },
  {
    id: 'access',
    name: 'nginx access log',
    description: '1,800 lines · shuffled timestamps · CLF bracket format',
    fileName: 'access.log',
    make: () => makeAccessLog(),
  },
  {
    id: 'app',
    name: 'application log',
    description: '900 events with multi-line stack traces',
    fileName: 'app.log',
    make: () => makeAppLog(),
  },
  {
    id: 'tx',
    name: 'transactions CSV',
    description: '1,400 rows · duplicate timestamps for the stability demo',
    fileName: 'transactions.csv',
    make: () => makeTransactionsCsv(),
  },
  {
    id: 'hostile',
    name: 'hostile CSV',
    description: 'BOM, CRLF, quoted commas, embedded newlines, ragged row',
    fileName: 'hostile.csv',
    make: () => makeHostileCsv(),
  },
  {
    id: 'stress',
    name: 'stress test · 200k lines',
    description: '200,000 records · proves the tab stays responsive',
    fileName: 'stress-200k.log',
    make: () => makeAccessLog(200_000, 4242),
  },
];

/** Random numeric series used by the complexity lab. */
export function makeRandomSeries(n: number, seed = 7): Float64Array {
  const rnd = mulberry32(seed);
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = rnd();
  return values;
}

/** Already-ascending series — the input that makes quicksort degrade. */
export function makeSortedSeries(n: number): Float64Array {
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = i;
  return values;
}
