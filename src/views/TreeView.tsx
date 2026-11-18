/**
 * Recursion Tree Lab.
 *
 * Runs a real merge sort on a slice of the loaded data (small enough to draw),
 * records every event, and lets you step through the tree: split, compare,
 * write, merge. Bars show the array, the dashed row shows the auxiliary buffer,
 * and the tree shows which subproblem is currently being solved.
 *
 * @module views/TreeView
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppState.tsx';
import { Panel, Segmented } from '../components/ui.tsx';
import { buildKeySeries } from '../parse/index.ts';
import { buildComparator, sliceSeries } from '../core/keys.ts';
import type { SortKeySpec } from '../core/keys.ts';
import { mergeSortIndices } from '../core/mergesort.ts';
import { buildFrames } from '../core/playback.ts';
import type { TreeNode } from '../core/types.ts';
import { formatInt } from '../lib/format.ts';

const ROW_H = 40;
const NODE_H = 19;

interface Placed {
  node: TreeNode;
  x: number;
  y: number;
}

function layoutTree(tree: TreeNode[]): { placed: Placed[]; leaves: number; width: number } {
  const children = new Map<string, TreeNode[]>();
  for (const node of tree) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId);
    if (list) list.push(node);
    else children.set(node.parentId, [node]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let leafCursor = 0;

  function place(node: TreeNode): number {
    const kids = children.get(node.id) ?? [];
    const y = node.depth * ROW_H;
    if (kids.length === 0) {
      const x = leafCursor++;
      positions.set(node.id, { x, y });
      return x;
    }
    const xs = kids.map(place);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    positions.set(node.id, { x, y });
    return x;
  }

  const root = tree.find((n) => n.parentId === null);
  if (root) place(root);

  const placed: Placed[] = tree.map((node) => {
    const p = positions.get(node.id) ?? { x: 0, y: node.depth * ROW_H };
    return { node, x: p.x, y: p.y };
  });

  return { placed, leaves: Math.max(1, leafCursor), width: Math.max(1, leafCursor) * 34 };
}

export function TreeView() {
  const { data, keyId, secondaryKeyId, order, loadSample, setView } = useApp();

  const total = data?.records.length ?? 0;
  const [subsetSize, setSubsetSize] = useState(16);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const n = Math.min(subsetSize, total);

  const run = useMemo(() => {
    if (!data || n === 0) return null;
    const primary = sliceSeries(buildKeySeries(data, keyId), n);
    const secondary =
      secondaryKeyId !== 'none' ? sliceSeries(buildKeySeries(data, secondaryKeyId), n) : undefined;
    const spec: SortKeySpec = { primary, primaryOrder: order, secondary, secondaryOrder: 'asc' };
    const result = mergeSortIndices(n, buildComparator(spec), {
      recordTree: true,
      recordEvents: true,
      maxEvents: 40_000,
    });
    return { result, spec, n };
  }, [data, keyId, secondaryKeyId, order, n]);

  const frames = useMemo(() => (run ? buildFrames(run.result.events, run.n) : []), [run]);
  const layout = useMemo(() => (run ? layoutTree(run.result.tree) : null), [run]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)] ?? null;

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
    setSelectedId(null);
  }, [run]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    if (frameIndex >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const delay = Math.max(24, 380 / speed);
    const timer = setTimeout(() => {
      setFrameIndex((i) => Math.min(frames.length - 1, i + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, frameIndex, frames.length, speed]);

  const doneIds = useMemo(() => {
    const done = new Set<string>();
    if (!run || !frame) return done;
    for (let i = 1; i <= frame.index; i++) {
      const ev = run.result.events[i - 1];
      if (ev && ev.t === 'merged') done.add(ev.nodeId);
    }
    return done;
  }, [run, frame]);

  if (!data) {
    return (
      <Panel title="Recursion tree" index="L1">
        <p className="muted small">Load a dataset first — the tree is drawn from a real run.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => loadSample('access')}
        >
          Load the nginx sample
        </button>
      </Panel>
    );
  }

  const activeId = frame?.nodeId ?? null;
  const inspected = selectedId
    ? run?.result.tree.find((node) => node.id === selectedId)
    : activeId
      ? run?.result.tree.find((node) => node.id === activeId)
      : undefined;

  const spec = run?.spec;
  const values = spec
    ? spec.primary.kind === 'num'
      ? Array.from(spec.primary.values)
      : spec.primary.values.map((v, i) => (v === '' ? i : v.length))
    : [];
  const maxV = values.length ? Math.max(...values) : 1;
  const minV = values.length ? Math.min(...values) : 0;
  const span = maxV - minV || 1;

  const rangeLo = frame?.lo ?? 0;
  const rangeHi = frame?.hi ?? n;

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div>
        <Panel
          index="L1"
          title="Recursion tree"
          tools={
            <div className="row" style={{ gap: 8 }}>
              <Segmented
                value={String(subsetSize)}
                ariaLabel="Number of elements to animate"
                options={[
                  { value: '8', label: '8' },
                  { value: '16', label: '16' },
                  { value: '32', label: '32' },
                ]}
                onChange={(value) => setSubsetSize(Number(value))}
              />
            </div>
          }
          bodyClassName="panel-body tight"
          foot={
            <>
              <span className="mono xs">
                {run?.result.metrics.comparisons ?? 0} comparisons · depth{' '}
                {run?.result.metrics.maxDepth ?? 0} · {run?.result.tree.length ?? 0} nodes
              </span>
              <span className="spacer" style={{ flex: 1 }} />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setView('theory')}>
                Why is the depth ⌈log₂n⌉? →
              </button>
            </>
          }
        >
          <div className="tree-stage">
            {layout && (
              <svg
                viewBox={`-16 -16 ${layout.width + 32} ${(run?.result.metrics.maxDepth ?? 0) * ROW_H + NODE_H + 28}`}
                className="tree-svg"
                role="img"
                aria-label={`Recursion tree with ${run?.result.tree.length} nodes and depth ${run?.result.metrics.maxDepth}`}
              >
                {layout.placed.map((p) => {
                  const kids = layout.placed.filter((q) => q.node.parentId === p.node.id);
                  return kids.map((kid) => {
                    const isActiveEdge =
                      kid.node.id === activeId || p.node.id === activeId;
                    return (
                      <line
                        key={`${p.node.id}->${kid.node.id}`}
                        x1={p.x * 34 + 17}
                        y1={p.y + NODE_H}
                        x2={kid.x * 34 + 17}
                        y2={kid.y}
                        className={isActiveEdge ? 'tree-edge is-active' : 'tree-edge'}
                      />
                    );
                  });
                })}

                {layout.placed.map((p) => {
                  const isActive = p.node.id === activeId;
                  const isDone = doneIds.has(p.node.id);
                  const isLeaf = p.node.size < 2;
                  const cls = [
                    'tree-node',
                    isActive ? 'is-active' : '',
                    isDone && !isActive ? 'is-done' : '',
                    isLeaf && !isActive ? 'is-leaf' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <g
                      key={p.node.id}
                      className={cls}
                      transform={`translate(${p.x * 34 + 3}, ${p.y})`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Node ${p.node.lo} to ${p.node.hi}, size ${p.node.size}`}
                      onClick={() => setSelectedId(p.node.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedId(p.node.id);
                        }
                      }}
                    >
                      <rect width={28} height={NODE_H} rx={4} />
                      <text x={14} y={10}>
                        {p.node.size}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div className="bars" aria-hidden="true">
            {frame?.order.map((originalIndex, position) => {
              const value = values[originalIndex] ?? 0;
              const height = 8 + ((value - minV) / span) * 88;
              const inRange = position >= rangeLo && position < rangeHi;
              const isAt = frame.at === position;
              const isAt2 = frame.at2 === position;
              return (
                <div
                  key={position}
                  className={[
                    'bar',
                    isAt ? 'is-writing' : '',
                    !isAt && isAt2 ? 'is-comparing' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    height: `${height}%`,
                    opacity: inRange ? 1 : 0.28,
                  }}
                >
                  {n <= 8 && <span>{originalIndex}</span>}
                </div>
              );
            })}
          </div>

          <div className="aux-row" aria-hidden="true">
            {frame?.aux.map((value, position) => (
              <div
                key={position}
                className={value === -1 ? 'aux-cell' : 'aux-cell is-filled'}
                style={{ opacity: position >= rangeLo && position < rangeHi ? 1 : 0.3 }}
              >
                {value === -1 ? '·' : value}
              </div>
            ))}
          </div>

          <div className="player">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setFrameIndex((i) => Math.max(0, i - 1))}
              disabled={frameIndex === 0}
              aria-label="Step back"
            >
              ◀
            </button>
            <button
              type="button"
              className="btn btn-primary btn-icon"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setFrameIndex((i) => Math.min(frames.length - 1, i + 1))}
              disabled={frameIndex >= frames.length - 1}
              aria-label="Step forward"
            >
              ▶
            </button>
            <input
              className="scrub"
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={frameIndex}
              aria-label="Playback position"
              onChange={(event) => {
                setPlaying(false);
                setFrameIndex(Number(event.target.value));
              }}
            />
            <Segmented
              value={String(speed)}
              ariaLabel="Playback speed"
              options={[
                { value: '0.5', label: '½×' },
                { value: '1', label: '1×' },
                { value: '2', label: '2×' },
                { value: '4', label: '4×' },
              ]}
              onChange={(value) => setSpeed(Number(value))}
            />
            <span className="counter">
              {frameIndex} / {Math.max(0, frames.length - 1)}
            </span>
          </div>
        </Panel>

        <Panel index="L3" title="Cost per level" bodyClassName="panel-body tight">
          <div className="table-scroll" style={{ maxHeight: 260 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Nodes</th>
                  <th>Elements touched</th>
                  <th>Comparisons</th>
                  <th>Merge cost</th>
                </tr>
              </thead>
              <tbody>
                {run?.result.levels.map((level) => (
                  <tr key={level.depth}>
                    <td className="num">{level.depth}</td>
                    <td className="num">{level.nodes}</td>
                    <td className="num">{level.elements}</td>
                    <td className="num">{formatInt(level.comparisons)}</td>
                    <td className="mono dim">Θ({level.elements})</td>
                  </tr>
                ))}
                <tr>
                  <td className="num">Σ</td>
                  <td className="num">{run?.result.tree.length}</td>
                  <td className="num">
                    {run?.result.levels.reduce((sum, l) => sum + l.elements, 0)}
                  </td>
                  <td className="num">{formatInt(run?.result.metrics.comparisons ?? 0)}</td>
                  <td className="mono" style={{ color: 'var(--accent)' }}>
                    Θ(n log n)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="rail" style={{ position: 'static' }}>
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">Step</h2>
            <span className="spacer" />
            <span className="chip">{frame?.kind ?? 'start'}</span>
          </header>
          <div className="panel-body">
            <p className="small" style={{ minHeight: 54 }}>
              {frame?.label ?? 'Nothing to replay yet.'}
            </p>
            <div className="kv">
              <span>Active range</span>
              <b>
                [{rangeLo}, {rangeHi})
              </b>
            </div>
            <div className="kv">
              <span>Sorted so far</span>
              <b>{doneIds.size} node(s)</b>
            </div>
            <div className="kv">
              <span>Elements</span>
              <b>{n}</b>
            </div>
            <p className="xs dim" style={{ marginTop: 10 }}>
              Highlighted bars are being compared or written. Dashed row = auxiliary buffer.
            </p>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">Node inspector</h2>
            <span className="spacer" />
            <span className="chip">click a node</span>
          </header>
          <div className="panel-body">
            {inspected ? (
              <>
                <div className="kv">
                  <span>Range</span>
                  <b>
                    [{inspected.lo}, {inspected.hi})
                  </b>
                </div>
                <div className="kv">
                  <span>Subproblem size</span>
                  <b>{inspected.size}</b>
                </div>
                <div className="kv">
                  <span>Depth</span>
                  <b>{inspected.depth}</b>
                </div>
                <div className="kv">
                  <span>Comparisons here</span>
                  <b>{formatInt(inspected.comparisons)}</b>
                </div>
                <div className="formula" style={{ marginTop: 12, fontSize: 12 }}>
                  {inspected.size < 2 ? (
                    <>T(1) = Θ(1) <span className="c">// base case</span></>
                  ) : (
                    <>
                      T({inspected.size}) = T({Math.ceil(inspected.size / 2)}) + T(
                      {Math.floor(inspected.size / 2)}) + Θ({inspected.size})
                    </>
                  )}
                </div>
                <p className="xs dim">
                  The merge step at this node touched {inspected.size} elements and made{' '}
                  {inspected.comparisons} comparison(s) — the Θ(k) term of the recurrence.
                </p>
              </>
            ) : (
              <p className="small muted">
                Press play, or click any node in the tree to inspect that subproblem.
              </p>
            )}
          </div>
        </section>

        <div className="callout">
          <b>Read the tree, not the bars.</b>
          <p>
            Every level touches n elements in total, and there are ⌈log₂n⌉ levels, so the work is
            n · ⌈log₂n⌉. The table below the tree shows that invariant holding row by row.
          </p>
        </div>
      </div>
    </div>
  );
}
