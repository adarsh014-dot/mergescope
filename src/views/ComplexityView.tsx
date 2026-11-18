/**
 * Complexity Lab: measures the algorithm instead of asserting its complexity.
 *
 * Each size is sorted for real in the worker; the chart plots measured
 * comparisons against the n·log₂n reference on log-log axes, where a polynomial
 * O(n^k) shows up as a straight line of slope k.
 *
 * @module views/ComplexityView
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Panel, Segmented } from '../components/ui.tsx';
import { Legend, LogLogChart } from '../components/Chart.tsx';
import type { ChartSeries } from '../components/Chart.tsx';
import { benchInWorker } from '../workers/client.ts';
import type { BenchRow } from '../workers/protocol.ts';
import { formatFloat, formatInt, formatMs } from '../lib/format.ts';

const SIZES = [100, 500, 2_000, 10_000, 50_000];

const COLORS = {
  merge: 'var(--accent)',
  quick: 'var(--err)',
  native: 'var(--info)',
  theory: 'var(--violet)',
  quadratic: 'var(--warn)',
};

export function ComplexityView() {
  const [rows, setRows] = useState<BenchRow[]>([]);
  const [pattern, setPattern] = useState<'random' | 'sorted'>('random');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuadratic, setShowQuadratic] = useState(false);
  const [stress, setStress] = useState<{ n: number; ms: number; comparisons: number } | null>(null);

  const runBenchmark = useCallback(async (nextPattern: 'random' | 'sorted') => {
    setRunning(true);
    setError(null);
    try {
      const result = await benchInWorker(SIZES, 7, nextPattern);
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void runBenchmark('random');
  }, [runBenchmark]);

  const bySize = useMemo(() => {
    const map = new Map<number, Partial<Record<BenchRow['alg'], BenchRow>>>();
    for (const row of rows) {
      const entry = map.get(row.n) ?? {};
      entry[row.alg] = row;
      map.set(row.n, entry);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const mergeRows = rows.filter((r) => r.alg === 'merge').sort((a, b) => a.n - b.n);

  const fitConstant =
    mergeRows.length > 0
      ? mergeRows.reduce((sum, r) => sum + r.comparisons / (r.n * Math.log2(r.n)), 0) /
        mergeRows.length
      : 1;

  const theoryPoints = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let e = 2; e <= 6; e += 0.25) {
      const n = 10 ** e;
      out.push({ x: n, y: fitConstant * n * Math.log2(n) });
    }
    return out;
  }, [fitConstant]);

  const quadraticPoints = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let e = 2; e <= 6; e += 0.25) {
      const n = 10 ** e;
      out.push({ x: n, y: (n * n) / 150 });
    }
    return out;
  }, []);

  const comparisonSeries: ChartSeries[] = [
    {
      label: 'merge sort',
      color: COLORS.merge,
      dots: true,
      points: rows.filter((r) => r.alg === 'merge').map((r) => ({ x: r.n, y: r.comparisons })),
    },
    {
      label: 'quicksort',
      color: COLORS.quick,
      dots: true,
      points: rows.filter((r) => r.alg === 'quick').map((r) => ({ x: r.n, y: r.comparisons })),
    },
    {
      label: 'native sort',
      color: COLORS.native,
      dots: true,
      points: rows.filter((r) => r.alg === 'native').map((r) => ({ x: r.n, y: r.comparisons })),
    },
    { label: 'n·log₂n fit', color: COLORS.theory, dashed: true, points: theoryPoints },
    ...(showQuadratic
      ? [{ label: 'n² (reference)', color: COLORS.quadratic, dashed: true, points: quadraticPoints }]
      : []),
  ];

  // Timings below the browser's timer resolution (~5 µs) are real but unmeasurable
  // here; plotting them would draw a fake flat line, so they are left out of the
  // timing plot while the table still reports them.
  const timed = (alg: 'merge' | 'quick' | 'native') =>
    rows
      .filter((r) => r.alg === alg && r.elapsedMs >= 0.005)
      .map((r) => ({ x: r.n, y: r.elapsedMs }));

  const timeSeries: ChartSeries[] = [
    { label: 'merge sort', color: COLORS.merge, dots: true, points: timed('merge') },
    { label: 'quicksort', color: COLORS.quick, dots: true, points: timed('quick') },
    { label: 'native sort', color: COLORS.native, dots: true, points: timed('native') },
  ];

  async function runStress(): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const result = await benchInWorker([1_000_000], 11, 'random');
      const merge = result.find((r) => r.alg === 'merge');
      if (merge) setStress({ n: merge.n, ms: merge.elapsedMs, comparisons: merge.comparisons });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="stack">
      <Panel
        index="C1"
        title="Measured complexity"
        tools={
          <div className="row" style={{ gap: 8 }}>
            <Segmented
              value={pattern}
              ariaLabel="Input pattern"
              options={[
                { value: 'random', label: 'Random' },
                { value: 'sorted', label: 'Already sorted' },
              ]}
              onChange={(value) => {
                setPattern(value);
                void runBenchmark(value);
              }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void runBenchmark(pattern)}
              disabled={running}
            >
              {running ? 'Measuring…' : 'Re-run'}
            </button>
          </div>
        }
        bodyClassName="panel-body tight"
        foot={
          <>
            <span className="xs dim">
              Seeded PRNG (seed 7) so every run measures the same data · times are the best of k
              repetitions, because browsers clamp <span className="mono">performance.now()</span> to
              ~100 µs.
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowQuadratic((v) => !v)}
            >
              {showQuadratic ? 'Hide' : 'Show'} n² reference
            </button>
          </>
        }
      >
        {error && (
          <div className="panel-body">
            <div className="callout err">{error}</div>
          </div>
        )}

        <div className="chart-wrap">
          <h3 className="label" style={{ padding: '4px 8px 0' }}>
            Comparisons vs n · log-log axes
          </h3>
          <LogLogChart
            series={comparisonSeries}
            xLabel="records n"
            yLabel="comparisons"
            emptyHint={running ? 'Measuring…' : 'Run the benchmark to plot comparisons.'}
          />
          <Legend
            series={[
              { label: 'merge sort (measured)', color: COLORS.merge },
              { label: 'quicksort (measured)', color: COLORS.quick },
              { label: 'native sort (measured)', color: COLORS.native },
              { label: 'n·log₂n (fitted)', color: COLORS.theory, dashed: true },
              ...(showQuadratic
                ? [{ label: 'n² (reference shape)', color: COLORS.quadratic, dashed: true }]
                : []),
            ]}
          />
        </div>

        <div className="chart-wrap" style={{ borderTop: '1px solid var(--line)' }}>
          <h3 className="label" style={{ padding: '4px 8px 0' }}>
            Wall-clock time vs n · log-log axes
          </h3>
          <LogLogChart
            series={timeSeries}
            xLabel="records n"
            yLabel="milliseconds"
            emptyHint={running ? 'Measuring…' : 'Run the benchmark to plot time.'}
          />
          <Legend
            series={[
              { label: 'merge sort', color: COLORS.merge },
              { label: 'quicksort', color: COLORS.quick },
              { label: 'native sort', color: COLORS.native },
            ]}
          />
        </div>
      </Panel>

      <Panel index="C2" title="Measured vs theoretical" bodyClassName="panel-body tight">
        <div className="table-scroll" style={{ maxHeight: 320 }}>
          <table className="data">
            <thead>
              <tr>
                <th>n</th>
                <th>merge cmp</th>
                <th>cmp / n·log₂n</th>
                <th>depth</th>
                <th>⌈log₂n⌉</th>
                <th>merge ms</th>
                <th>quick cmp</th>
                <th>quick ms</th>
                <th>native ms</th>
              </tr>
            </thead>
            <tbody>
              {bySize.map(([n, entry]) => {
                const merge = entry.merge;
                const quick = entry.quick;
                const native = entry.native;
                const expected = Math.ceil(Math.log2(n));
                const depthMatches = merge ? merge.depth === expected : false;
                return (
                  <tr key={n}>
                    <td className="num">{formatInt(n)}</td>
                    <td className="num">{merge ? formatInt(merge.comparisons) : '—'}</td>
                    <td className="num">
                      {merge ? formatFloat(merge.comparisons / (n * Math.log2(n)), 2) : '—'}
                    </td>
                    <td className="num">{merge ? merge.depth : '—'}</td>
                    <td className="num">
                      {expected}{' '}
                      <span style={{ color: depthMatches ? 'var(--ok)' : 'var(--err)' }}>
                        {depthMatches ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="num">{merge ? formatMs(merge.elapsedMs) : '—'}</td>
                    <td className="num">{quick ? formatInt(quick.comparisons) : 'skipped'}</td>
                    <td className="num">{quick ? formatMs(quick.elapsedMs) : '—'}</td>
                    <td className="num">{native ? formatMs(native.elapsedMs) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <span className="xs dim">
            The ratio column stays near a constant — which is exactly what Θ(n log n) means. Deepest
            level equals ⌈log₂n⌉ for every size, as the recurrence predicts.
          </span>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel index="C3" title="Stress test">
          <p className="small muted">
            One million records, measured in the worker while the UI keeps painting. This is the
            practical size where an O(n²) algorithm would never finish.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => void runStress()}
            disabled={running}
          >
            {running ? 'Running…' : 'Sort 1,000,000 records'}
          </button>
          {stress && (
            <div className="metric-grid" style={{ marginTop: 14, marginInline: -18, marginBottom: -18 }}>
              <div className="metric">
                <div className="metric-label">records</div>
                <div className="metric-value">{formatInt(stress.n)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">comparisons</div>
                <div className="metric-value">{formatInt(stress.comparisons)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">sort time</div>
                <div className="metric-value">{formatMs(stress.ms)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">cmp / n·log₂n</div>
                <div className="metric-value">
                  {formatFloat(stress.comparisons / (stress.n * Math.log2(stress.n)), 2)}
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel index="C4" title="How to read this">
          <div className="prose" style={{ fontSize: 13.5 }}>
            <p>
              <strong>Straight lines mean polynomial growth.</strong> On log-log axes, T(n) = Θ(n^k)
              appears as a line of slope k. The merge sort line sits parallel to the fitted n·log₂n
              curve, and it never breaks upward the way quicksort does on sorted input.
            </p>
            <p>
              <strong>Already-sorted input</strong> is the interesting case: merge sort does its
              usual Θ(n log n) work, while Lomuto quicksort collapses to Θ(n²) because every pivot is
              already the largest element. Switch the pattern to see the red line dive.
            </p>
            <p>
              <strong>Native sort is a baseline, not a contest.</strong> Array.prototype.sort is
              TimSort here — a merge sort hybrid. It is faster because it is written in optimised C++
              and exploits existing runs; it is in the chart to show the constant factor, not to
              replace the algorithm being demonstrated.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
