/**
 * Number / date / size formatting. Every value shown in the UI goes through
 * here so the app has one consistent numeric voice.
 *
 * @module lib/format
 */

const nf = new Intl.NumberFormat('en-US');

export function formatInt(n: number): string {
  return nf.format(Math.round(n));
}

export function formatFloat(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Safe for NaN / missing timestamps. */
export function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  const pad = (v: number, w = 2): string => String(v).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.` +
    `${pad(d.getUTCMilliseconds(), 3)}`
  );
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}
