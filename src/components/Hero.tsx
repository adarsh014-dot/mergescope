/**
 * Landing hero — shown until a dataset is loaded.
 *
 * The tree drawn on the right is computed from the same recurrence the app
 * executes for n = 8, so the picture is a real recursion tree rather than a
 * decorative diagram.
 *
 * @module components/Hero
 */

import { useApp } from '../state/AppState.tsx';
import { Stat } from './ui.tsx';

interface MiniNode {
  lo: number;
  hi: number;
  depth: number;
  x: number;
  y: number;
}

/** Lays out the recursion tree of top-down merge sort for a supply of leaves. */
function miniTree(n: number): { nodes: MiniNode[]; edges: [MiniNode, MiniNode][] } {
  const nodes: MiniNode[] = [];
  const edges: [MiniNode, MiniNode][] = [];
  let nextLeaf = 0;

  function walk(lo: number, hi: number, depth: number): MiniNode {
    const node: MiniNode = { lo, hi, depth, x: 0, y: depth * 26 };
    if (hi - lo < 2) {
      node.x = nextLeaf++;
      nodes.push(node);
      return node;
    }
    const mid = (lo + hi) >> 1;
    const left = walk(lo, mid, depth + 1);
    const right = walk(mid, hi, depth + 1);
    node.x = (left.x + right.x) / 2;
    nodes.push(node);
    edges.push([node, left], [node, right]);
    return node;
  }

  walk(0, n, 0);
  return { nodes, edges };
}

const TREE = miniTree(8);
const CELL = 46;

export function Hero() {
  const { loadSample, setView } = useApp();

  return (
    <section className="hero">
      <div className="row" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="hero-eyebrow">Merge sort · recursion tree · Unit 1</div>
          <h1>
            Sort a million log lines.
            <br />
            See <em>every comparison</em>.
          </h1>
          <p className="hero-sub">
            MergeScope sorts log files and CSV records with a hand-written merge sort, then shows you
            the recursion tree that did the work — depth, comparisons per level, and the auxiliary
            memory it cost. Upload nothing: parsing and sorting run in your browser.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn btn-primary" onClick={() => loadSample('access')}>
              Try the nginx sample (1,800 lines)
            </button>
            <button type="button" className="btn" onClick={() => setView('theory')}>
              Read the complexity derivation
            </button>
          </div>
          <div className="hero-stats">
            <Stat value="Θ(n log n)" label="time, all cases" />
            <Stat value="Θ(n)" label="extra space" />
            <Stat value="2n − 1" label="recursion tree nodes" />
            <Stat value="stable" label="equal keys keep order" />
          </div>
        </div>

        <div style={{ flex: '0 1 380px', minWidth: 260 }}>
          <svg
            viewBox={`-30 -24 ${8 * CELL + 40} ${3 * 26 + 54}`}
            className="tree-svg"
            role="img"
            aria-label="Recursion tree of merge sort on eight elements"
          >
            {TREE.edges.map(([parent, child], i) => (
              <line
                key={i}
                x1={parent.x * CELL + CELL / 2}
                y1={parent.y + 12}
                x2={child.x * CELL + CELL / 2}
                y2={child.y}
                className="tree-edge"
                opacity={0.75}
              />
            ))}
            {TREE.nodes.map((node, i) => {
              const width = Math.max(CELL - 8, 26);
              const leaf = node.hi - node.lo < 2;
              return (
                <g
                  key={i}
                  className={leaf ? 'tree-node is-leaf' : 'tree-node'}
                  transform={`translate(${node.x * CELL + CELL / 2 - width / 2}, ${node.y})`}
                >
                  <rect width={width} height={17} rx={4} />
                  <text x={width / 2} y={8.8}>
                    {node.lo}:{node.hi}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="xs dim" style={{ textAlign: 'center', marginTop: 6 }}>
            n = 8 → depth ⌈log₂8⌉ = 3, 15 nodes, every level touching 8 elements.
          </p>
        </div>
      </div>
    </section>
  );
}
