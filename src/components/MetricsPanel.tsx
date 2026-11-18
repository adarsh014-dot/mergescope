/**
 * Measured metrics rail. Every number here comes from the worker's counters.
 *
 * @module components/MetricsPanel
 */

import { useApp } from '../state/AppState.tsx';
import { Metric } from './ui.tsx';
import { formatFloat, formatInt, formatMs } from '../lib/format.ts';

export function MetricsPanel() {
  const { result, data, sorting, sortError } = useApp();

  const n = data?.records.length ?? 0;
  const log2n = n > 1 ? Math.ceil(Math.log2(n)) : 0;
  const bound = n > 1 ? n * log2n : 0;
  const metrics = result?.metrics;
  const ratio = metrics && bound > 0 ? Math.min(1, metrics.comparisons / bound) : 0;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">
          <span className="idx">03</span> Measured
        </h2>
        <span className="spacer" />
        {sorting ? (
          <span className="chip">running…</span>
        ) : metrics ? (
          <span className="chip accent">live</span>
        ) : (
          <span className="chip">—</span>
        )}
      </header>

      {sortError && (
        <div className="panel-body">
          <div className="callout err" role="alert">
            <b>Sort failed.</b> {sortError}
          </div>
        </div>
      )}

      {!metrics && !sortError && (
        <div className="panel-body">
          <p className="small muted">
            Load a dataset to measure comparisons, recursion depth and memory.
          </p>
        </div>
      )}

      {metrics && (
        <>
          <div className="metric-grid">
            <Metric
              label="Comparisons"
              value={formatInt(metrics.comparisons)}
              sub={`${formatFloat(bound > 0 ? metrics.comparisons / n : 0, 2)} per record`}
              accent
            />
            <Metric label="Moves" value={formatInt(metrics.moves)} sub="writes into the order" />
            <Metric
              label="Recursion depth"
              value={metrics.maxDepth}
              sub={`${metrics.levels} tree levels · ⌈log₂n⌉ = ${log2n}`}
            />
            <Metric
              label="Time"
              value={formatMs(metrics.elapsedMs)}
              sub={formatInt(metrics.recursiveCalls) + ' recursive calls'}
            />
            <Metric
              label="Aux memory"
              value={formatInt(metrics.peakAuxElements)}
              unit="elems"
              sub="one buffer, Θ(n) — not in place"
            />
            <Metric
              label="Records"
              value={formatInt(n)}
              sub={`${formatInt(log2n)} halvings`}
              accent={false}
            />
          </div>

          <div className="panel-body" style={{ paddingTop: 12 }}>
            <div className="row between xs muted">
              <span>Comparisons vs n·⌈log₂n⌉ ceiling</span>
              <span className="mono">
                {formatInt(metrics.comparisons)} / {formatInt(bound)}
              </span>
            </div>
            <div className="ms-bar" aria-hidden="true">
              <i
                style={{
                  width: `${(ratio * 100).toFixed(1)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <div className="chips" style={{ marginTop: 12 }}>
              <span className="chip accent">Θ(n log n)</span>
              <span className="chip">Θ(n) space</span>
              <span className="chip">stable</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
