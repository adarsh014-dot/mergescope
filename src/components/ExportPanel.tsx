/**
 * Export panel — hands the user their file back in sorted order, plus the
 * measured metrics as a report they can paste into their write-up.
 *
 * @module components/ExportPanel
 */

import { useApp } from '../state/AppState.tsx';
import { buildLevelsCsv, buildReport, download, rebuildFile } from '../lib/export.ts';

export function ExportPanel() {
  const { data, result, spec, fileName } = useApp();

  if (!data || !result || !spec) return null;

  const stem = (fileName || 'mergescope').replace(/\.[^.]+$/, '');
  const ext = data.kind === 'csv' ? 'csv' : 'log';

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">
          <span className="idx">06</span> Export
        </h2>
      </header>
      <div className="panel-body">
        <div className="stack" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(`${stem}.sorted.${ext}`, rebuildFile(data, result.order), 'text/plain')
            }
          >
            ↓ Sorted {ext.toUpperCase()} ({data.records.length.toLocaleString()} records)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(`${stem}.metrics.json`, buildReport(fileName, data, spec, result), 'application/json')
            }
          >
            ↓ metrics.json — full report
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => download(`${stem}.levels.csv`, buildLevelsCsv(result), 'text/csv')}
          >
            ↓ levels.csv — cost per recursion level
          </button>
        </div>
        <p className="xs dim" style={{ marginTop: 10 }}>
          The report records the recurrence, the measured depth against ⌈log₂n⌉ and whether the
          comparison count stayed inside its ceiling.
        </p>
      </div>
    </section>
  );
}
