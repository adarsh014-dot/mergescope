/**
 * Small presentational primitives shared by every view.
 *
 * @module components/ui
 */

import { useId, useState } from 'react';
import type { ReactNode } from 'react';

export function Panel({
  title,
  index,
  tools,
  foot,
  children,
  bodyClassName,
}: {
  title?: ReactNode;
  index?: string;
  tools?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="panel">
      {(title || tools) && (
        <header className="panel-head">
          <h2 className="panel-title">
            {index && <span className="idx">{index}</span>}
            {title}
          </h2>
          <span className="spacer" />
          {tools}
        </header>
      )}
      <div className={bodyClassName ?? 'panel-body'}>{children}</div>
      {foot && <footer className="panel-foot">{foot}</footer>}
    </section>
  );
}

export function Metric({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'metric accent' : 'metric'}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

const SEVERITY_CLASS: Record<string, string> = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  NOTICE: 'info',
  WARN: 'warn',
  WARNING: 'warn',
  ERROR: 'error',
  ERR: 'error',
  CRITICAL: 'critical',
  CRIT: 'critical',
  FATAL: 'fatal',
  EMERGENCY: 'emergency',
  EMERG: 'emergency',
};

export function SeverityBadge({ severity }: { severity: string }) {
  if (!severity) return <span className="dim">—</span>;
  const cls = SEVERITY_CLASS[severity] ?? 'info';
  return <span className={`badge badge-${cls}`}>{severity}</span>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const id = useId();

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy} aria-describedby={id}>
      <span id={id} aria-live="polite">
        {copied ? '✓ Copied' : label}
      </span>
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat-chip">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
