/**
 * Virtualised results table.
 *
 * Only the visible rows are mounted, so a 200,000-record file scrolls at 60fps
 * and never warns the examiner's laptop.
 *
 * @module components/ResultsTable
 */

import { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppState.tsx';
import { Panel, SeverityBadge, Segmented } from './ui.tsx';
import { formatInt, formatTimestamp } from '../lib/format.ts';

const ROW_HEIGHT = 30;
const VIEWPORT_HEIGHT = 452;
const OVERSCAN = 6;

const GRID = '54px 178px 96px 132px minmax(0, 1fr)';
const GRID_WITH_KEY = '40px 84px 176px 84px 104px minmax(0, 1fr)';

const KEY_LABEL: Record<string, string> = {
  time: 'timestamp',
  severity: 'severity',
  source: 'source',
  message: 'message',
  line: 'line',
  raw: 'raw',
};

export function ResultsTable() {
  const { data, records, sortedRecords, sorting, result, keyId } = useApp();
  const [mode, setMode] = useState<'sorted' | 'original'>('sorted');
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const rows = mode === 'sorted' ? sortedRecords : records;

  const lowercased = useMemo(() => rows.map((row) => row.raw.toLowerCase()), [rows]);

  const filtered = useMemo(() => {
    if (query.trim() === '') return rows.map((_, i) => i);
    const needle = query.trim().toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < lowercased.length; i++) {
      if (lowercased[i].includes(needle)) out.push(i);
    }
    return out;
  }, [rows, lowercased, query]);

  if (!data) return null;

  // When the user sorts by something other than time, show that key as its own
  // column — otherwise a sort by "amount" looks like nothing happened.
  const showKey = keyId !== 'time';
  const columnName = keyId.startsWith('col:') ? keyId.slice(4) : '';
  const columnIndex = columnName ? data.columns.indexOf(columnName) : -1;
  const keyLabel = columnName || KEY_LABEL[keyId] || keyId;

  function keyValue(row: (typeof records)[number]): string {
    if (columnIndex >= 0) return row.cells[columnIndex] ?? '';
    switch (keyId) {
      case 'severity':
        return row.severity || '—';
      case 'source':
        return row.source || '—';
      case 'message':
      case 'raw':
        return row.message;
      case 'line':
        return String(row.line);
      default:
        return formatTimestamp(row.time);
    }
  }

  const total = filtered.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const visible = filtered.slice(start, end);

  return (
    <Panel
      index="04"
      title="Records"
      bodyClassName="panel-body tight"
      tools={
        <div className="row" style={{ gap: 8 }}>
          <Segmented
            value={mode}
            ariaLabel="Row order"
            options={[
              { value: 'sorted', label: 'Sorted' },
              { value: 'original', label: 'Original' },
            ]}
            onChange={setMode}
          />
        </div>
      }
      foot={
        <>
          <span className="mono">
            {formatInt(total)}
            {query.trim() !== '' && ` of ${formatInt(rows.length)}`} rows
          </span>
          {result?.truncated && (
            <span className="dim">
              · recursion tree summarised for this size (2n−1 nodes would be too many to draw)
            </span>
          )}
          {sorting && <span className="dim">· re-sorting…</span>}
        </>
      }
    >
      <div className="table-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Filter rows…"
          value={query}
          aria-label="Filter rows"
          onChange={(event) => {
            setQuery(event.target.value);
            setScrollTop(0);
            if (viewportRef.current) viewportRef.current.scrollTop = 0;
          }}
        />
        <span className="xs dim">
          {mode === 'sorted' ? 'output order' : 'file order'}
          {mode === 'sorted' && ' · ties keep file order'}
        </span>
          <span className="spacer" style={{ flex: 1 }} />
        {showKey && <span className="chip accent">sorted by {keyLabel}</span>}
        <span className="chip" title="Only the visible rows are mounted">
          virtualised
        </span>
      </div>

      <div
        className="table-scroll"
        ref={viewportRef}
        style={{ height: Math.min(VIEWPORT_HEIGHT, Math.max(ROW_HEIGHT, total * ROW_HEIGHT)) }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        tabIndex={0}
        role="grid"
        aria-rowcount={total}
        aria-label="Parsed records"
      >
        <div style={{ height: total * ROW_HEIGHT, position: 'relative' }}>
          {visible.map((rowIndex) => {
            const row = rows[rowIndex];
            return (
              <div
                key={row.id}
                className="vrow"
                role="row"
                style={{
                  top: rowIndex * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  gridTemplateColumns: showKey ? GRID_WITH_KEY : GRID,
                }}
              >
                <span className="num dim">{rowIndex + 1}</span>
                {showKey && (
                  <span
                    className="num xs"
                    style={{
                      color: 'var(--accent)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={`${keyLabel}: ${keyValue(row)}`}
                  >
                    {keyValue(row)}
                  </span>
                )}
                <span className="num" style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(row.time)}</span>
                <span>
                  <SeverityBadge severity={row.severity} />
                </span>
                <span className="mono xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.source || '—'}
                </span>
                <span
                  className="small"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={row.message}
                >
                  {row.message.replace(/\n/g, ' ⏎ ')}
                </span>
              </div>
            );
          })}
          {total === 0 && (
            <div className="empty" style={{ position: 'absolute', inset: 0, paddingTop: 60 }}>
              <b>No rows match “{query}”.</b>
              Try a shorter filter.
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
