/**
 * Data source panel: drag & drop, file picker, pasted text, sample datasets.
 *
 * @module components/SourcePanel
 */

import { useRef, useState } from 'react';
import { useApp } from '../state/AppState.tsx';
import { SAMPLE_DATASETS } from '../data/samples.ts';
import { formatBytes, formatInt } from '../lib/format.ts';

export function SourcePanel() {
  const { data, fileName, loadFile, loadSample, loadText, clear, loading, loadError } = useApp();
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  if (data) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">
            <span className="idx">01</span> Source
          </h2>
          <span className="spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>
            Load another file
          </button>
        </header>
        <div className="panel-body">
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="chip accent">{data.kind.toUpperCase()}</span>
            <span className="chip">{fileName}</span>
            <span className="chip">{formatInt(data.records.length)} records</span>
            <span className="chip">{formatBytes(data.bytes)}</span>
            <span className="chip">
              {formatInt(data.warnings.length)} parse warning{data.warnings.length === 1 ? '' : 's'}
            </span>
          </div>
          {data.warnings.length > 0 && (
            <ul className="small muted" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
              {data.warnings.slice(0, 4).map((warning, i) => (
                <li key={i}>{warning.reason}</li>
              ))}
              {data.warnings.length > 4 && <li>…and {data.warnings.length - 4} more.</li>}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">
          <span className="idx">01</span> Source
        </h2>
        <span className="spacer" />
        <span className="chip">stays on this device</span>
      </header>
      <div className="panel-body">
        <div
          className={dragging ? 'dropzone is-over' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <h3>Drop a .log or .csv file</h3>
          <p>
            Multi-line events stay glued together. Nothing is uploaded — parsing and sorting happen
            in your browser.
          </p>
          <div className="dz-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? 'Reading…' : 'Choose file'}
            </button>
            <button type="button" className="btn" onClick={() => setPasting((v) => !v)}>
              Paste text
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".log,.csv,.txt,.tsv,text/plain,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        {pasting && (
          <div style={{ marginTop: 14 }}>
            <label className="label" htmlFor="paste-area">
              Paste log or CSV content
            </label>
            <textarea
              id="paste-area"
              className="input"
              rows={6}
              value={pasteValue}
              placeholder={'2024-05-01T09:00:03Z [billing] ERROR charge failed\n    at BillingClient.charge (client.ts:88)'}
              onChange={(event) => setPasteValue(event.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pasteValue.trim() === ''}
                onClick={() => {
                  loadText('pasted.log', pasteValue);
                  setPasting(false);
                }}
              >
                Use this text
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPasting(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="callout err" style={{ marginTop: 14 }} role="alert">
            {loadError}
          </div>
        )}

        <div className="hairline" />
        <div className="row between">
          <span className="label">Or start with a sample</span>
          <span className="xs dim">seeded · reproducible</span>
        </div>
        <div className="samples">
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="sample-btn"
              onClick={() => loadSample(sample.id)}
            >
              <b>{sample.name}</b>
              <span>{sample.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
