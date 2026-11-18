/**
 * Workbench — the main screen: source, keys, results and the measured rail.
 *
 * @module views/WorkbenchView
 */

import { useApp } from '../state/AppState.tsx';
import { Hero } from '../components/Hero.tsx';
import { SourcePanel } from '../components/SourcePanel.tsx';
import { ControlsPanel } from '../components/ControlsPanel.tsx';
import { ResultsTable } from '../components/ResultsTable.tsx';
import { MetricsPanel } from '../components/MetricsPanel.tsx';
import { StabilityPanel } from '../components/StabilityPanel.tsx';
import { ExportPanel } from '../components/ExportPanel.tsx';

const STEPS = [
  {
    title: 'Parse into records',
    body: 'Log lines are grouped so a stack trace stays attached to its ERROR. CSV is read with a real RFC-4180 parser — quoted commas, embedded newlines and all.',
  },
  {
    title: 'Sort with merge sort',
    body: 'A hand-written, instrumented top-down merge sort runs in a Web Worker. Comparisons, moves, depth and the auxiliary buffer are counted, not estimated.',
  },
  {
    title: 'Inspect the cost',
    body: 'The recursion tree is recorded from the run itself, so you can step through it, check the per-level cost and export the numbers.',
  },
];

export function WorkbenchView() {
  const { data } = useApp();

  if (!data) {
    return (
      <div className="stack">
        <Hero />
        <SourcePanel />
        <div className="grid-3">
          {STEPS.map((step, i) => (
            <section className="panel" key={step.title}>
              <div className="panel-body">
                <div className="chip" style={{ marginBottom: 10 }}>
                  0{i + 1}
                </div>
                <h3 style={{ fontSize: 'var(--step-1)', marginBottom: 6 }}>{step.title}</h3>
                <p className="small muted">{step.body}</p>
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wb-grid">
      <div>
        <SourcePanel />
        <ControlsPanel />
        <ResultsTable />
      </div>
      <aside className="rail">
        <MetricsPanel />
        <StabilityPanel />
        <ExportPanel />
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">
              <span className="idx">07</span> Why merge sort
            </h2>
          </header>
          <div className="panel-body">
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75 }}>
              <li>
                <strong style={{ color: 'var(--text-2)' }}>Predictable:</strong> Θ(n log n) even when
                the file is already sorted — the common case for re-sorted logs.
              </li>
              <li>
                <strong style={{ color: 'var(--text-2)' }}>Stable:</strong> “severity, then time”
                keeps each millisecond&apos;s events in file order.
              </li>
              <li>
                <strong style={{ color: 'var(--text-2)' }}>Sequential:</strong> merging only reads
                forward, which is why it is the basis of external sorting for files bigger than RAM.
              </li>
              <li>
                <strong style={{ color: 'var(--text-2)' }}>Costly:</strong> Θ(n) extra memory. That
                is the trade-off this tool measures rather than hides.
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </div>
  );
}
