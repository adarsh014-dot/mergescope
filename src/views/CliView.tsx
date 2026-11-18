/**
 * CLI & docs view.
 *
 * @module views/CliView
 */

import { CopyButton, Panel } from '../components/ui.tsx';

const SAMPLE_OUTPUT = `MergeScope  tmp/access.log
────────────────────────────────────────────────────────────────────────
  400 log records · key time · ascending
  comparisons 2,961 · moves 3,488 · depth 9 (theory ⌈log₂n⌉ = 9) · 1.3 ms
  auxiliary buffer 400 elements · Θ(n) space · stable
────────────────────────────────────────────────────────────────────────
  #    timestamp                severity source          message
  1    2024-05-01 09:00:26.000  —        10.0.9.3        10.0.9.3 - u_2210 "PATCH /v1/orders?page=2
  2    2024-05-01 09:01:00.000  —        10.0.9.3        10.0.9.3 - u_4102 "POST /healthz?q=invoice
  3    2024-05-01 09:01:51.000  —        10.0.4.12       10.0.4.12 - u_4102 "DELETE /v1/orders/42
  … 397 more records`;

const COMMANDS = [
  { cmd: 'node cli/index.ts access.log --key time --limit 10', note: 'sort a log by timestamp' },
  { cmd: 'node cli/index.ts app.log --key severity --then time', note: 'severity groups, time inside each' },
  { cmd: 'node cli/index.ts tx.csv --key col:amount --order desc', note: 'largest transactions first' },
  { cmd: 'node cli/index.ts access.log --key time --json', note: 'machine-readable metrics report' },
  { cmd: 'node cli/index.ts access.log --key time --out sorted.log', note: 'write the sorted file' },
];

const FLAGS = [
  ['--key <id>', 'primary sort key — time, severity, source, message, line, or col:<name>'],
  ['--then <id>', 'secondary key, used only when primary keys are equal'],
  ['--order', 'asc or desc (default asc)'],
  ['--limit <n>', 'rows to print (default 8)'],
  ['--out <path>', 'write the sorted file next to the original'],
  ['--json', 'print the measured report instead of a table'],
];

export function CliView() {
  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="stack">
        <Panel index="X1" title="The same algorithm, in a terminal">
          <p className="small muted">
            The CLI imports <span className="mono">src/core/mergesort.ts</span> directly — the exact
            code the website runs. There is no second implementation to drift out of sync, and no
            dependencies to install: Node 22.18+ runs the TypeScript directly.
          </p>
          <pre className="code">{`node cli/index.ts access.log --key time --limit 10`}</pre>
          <div className="table-scroll" style={{ maxHeight: 300, border: '1px solid var(--line)', borderRadius: 10 }}>
            <table className="data">
              <tbody>
                {COMMANDS.map((row) => (
                  <tr key={row.cmd}>
                    <td style={{ width: '60%' }}>
                      <span className="mono" style={{ fontSize: 11.5 }}>{row.cmd}</span>
                    </td>
                    <td className="muted small">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hairline" />
          <div className="row wrap">
            <span className="label">Options</span>
          </div>
          <table className="data" style={{ marginTop: 6 }}>
            <tbody>
              {FLAGS.map(([flag, note]) => (
                <tr key={flag}>
                  <td style={{ width: 120 }}>
                    <span className="mono" style={{ fontSize: 11.5 }}>{flag}</span>
                  </td>
                  <td className="muted small">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          index="X2"
          title="Real output"
          tools={<CopyButton text={SAMPLE_OUTPUT} label="Copy output" />}
        >
          <pre className="code" style={{ margin: 0 }}>{SAMPLE_OUTPUT}</pre>
          <p className="xs dim" style={{ marginTop: 10 }}>
            Note the depth line: for 400 records, ⌈log₂400⌉ = 9 and the measured depth is 9. The
            up-front table is the same measurement the Workbench shows.
          </p>
        </Panel>
      </div>

      <div className="rail" style={{ position: 'static' }}>
        <Panel index="X3" title="Run the website">
          <div className="stack" style={{ gap: 10 }}>
            {[
              { label: 'Install dependencies', cmd: 'npm install' },
              { label: 'Dev server (localhost:5173)', cmd: 'npm run dev' },
              { label: 'Production build', cmd: 'npm run build' },
              { label: 'Test suite', cmd: 'npm test' },
            ].map((item) => (
              <div key={item.cmd}>
                <div className="label" style={{ marginBottom: 4 }}>{item.label}</div>
                <div className="row" style={{ gap: 8 }}>
                  <code className="grow" style={{ background: 'var(--panel-2)', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>
                    {item.cmd}
                  </code>
                  <CopyButton text={item.cmd} label="Copy" />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel index="X4" title="Project layout">
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.95 }}>
            <li><span className="mono">src/core/</span> — merge sort, quicksort, keys, playback, stability</li>
            <li><span className="mono">src/parse/</span> — CSV and log readers</li>
            <li><span className="mono">src/workers/</span> — off-thread sorting</li>
            <li><span className="mono">src/components/</span> — UI primitives and panels</li>
            <li><span className="mono">src/views/</span> — Workbench, Tree, Complexity, Theory</li>
            <li><span className="mono">src/data/</span> — seeded sample generators</li>
            <li><span className="mono">cli/</span> — command-line entry point</li>
            <li><span className="mono">tests/</span> — correctness, stability, edge cases</li>
          </ul>
        </Panel>

        <div className="callout">
          <b>No server, no upload, no database.</b>
          <p>
            Files are read with the File API, parsed in the tab and sorted in a Web Worker. Nothing
            leaves the machine — which is why it works on a locked-down lab PC with no internet.
          </p>
        </div>
      </div>
    </div>
  );
}
