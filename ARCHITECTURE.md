# Architecture

MergeScope is one Vite + React + TypeScript app with a deliberately hard boundary between *the
algorithm* and *everything that displays it*. That boundary is the reason the CLI can reuse the
sorter and the test suite can assert on it without a browser.

```
┌──────────────────────────── UI (React, main thread) ────────────────────────────┐
│  views/      Workbench · Tree · Complexity · Theory · CLI                        │
│  components/ panels, table, chart, tree player, primitives                       │
│  state/      AppState — the only store; no external state library                │
└───────────────┬─────────────────────────────────────────────┬───────────────────┘
                │ key series (Float64Array | string[])        │ Permutation + metrics
                ▼                                             │ + tree + events
┌────────────────────────── Worker (sort.worker.ts) ───────────┴───────────────────┐
│  core/mergesort.ts   ← the algorithm, pure, instrumented, DOM-free               │
│  core/quicksort.ts   ← the unstable / Θ(n²)-worst-case contrast                  │
│  core/keys.ts        ← key projection + the one shared comparator                │
└─────────────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────────────────────────────┐
│  parse/  csv.ts · log.ts · types.ts — file → records (+ warnings)                │
│  data/   samples.ts — seeded synthetic datasets                                  │
│  lib/    format.ts · export.ts — formatting, download, metrics report            │
│  cli/    index.ts — the same sorter, in a terminal (Node type stripping)         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Module responsibilities

| Module | Responsibility | Notes / effort |
| --- | --- | --- |
| `core/mergesort.ts` | The algorithm and the counters. | ~180 lines. The single source of truth. Reused by the worker, the tree lab and the CLI. ~20% of the effort. |
| `core/types.ts` | `SortMetrics`, `TreeNode`, `SortEvent`, `SortResult`. | Contract-first; every layer speaks these types. ~4%. |
| `core/keys.ts` | Project a record column into a compact key series; build the comparator (multi-key, direction, missing-values-last). | One comparator for UI, worker, CLI and tests — no drift possible. ~8%. |
| `core/playback.ts` | Replay events into immutable frames. | Contains **no** sorting logic; this is what makes step-back possible. ~6%. |
| `core/stability.ts` | Verify stability on the actual output permutation. | Turns a claim into a measurement. ~3%. |
| `core/quicksort.ts` | Lomuto quicksort + insertion sort, for contrast and benchmarks. | Clearly labelled "not the main path". ~5%. |
| `parse/csv.ts` | RFC-4180-style reader. | BOM, CRLF, quotes, escaped quotes, embedded newlines, ragged rows, delimiter detection. ~7%. |
| `parse/log.ts` | Log reader: records (not lines), timestamps, severity, source. | Multi-line events glued to their parent record. ~7%. |
| `parse/index.ts` | Format detection, key options, key series projection. | ~6%. |
| `workers/sort.worker.ts` | Off-thread sorting + benchmark harness. | Encodes the capture caps (tree ≤ 65,536, events ≤ 64). ~6%. |
| `components/` | Panels, virtualised table, log-log chart, tree player. | `ResultsTable` is virtualised (only visible rows mount). ~14%. |
| `views/` | Five screens: Workbench, Tree, Complexity, Theory, CLI docs. | ~12%. |
| `styles/` | Design tokens + one stylesheet. | No UI framework; light and dark are tuned separately. ~4%. |
| `cli/` | Terminal entry point reusing `core`. | Proof of reuse; zero extra dependencies. ~3%. |
| `tests/` | 49 assertions. | Invariants the report claims. ~5%. |

## Data flow of a single sort

1. `parseFile(name, text)` → `{ kind, records, columns, warnings, bytes }`.
2. `buildKeySeries(data, keyId)` → `{ kind: 'num', values: Float64Array }` or `{ kind: 'str', values: string[] }`.
3. `postMessage({ type: 'sort', n, spec, options })` — key series only, never records.
4. Worker: `buildComparator(spec)` → `mergeSortIndices(n, cmp, opts)`.
5. Worker returns `{ order: Int32Array, metrics, tree, events, levels }`; `order` is transferred, not copied.
6. UI derives: table rows (`records[order[i]]`), metrics rail, stability panel, exports, and the
   tree player (which re-runs a small slice locally so it can animate without a second round-trip).

## The contracts that keep it honest

```ts
interface SortMetrics {
  comparisons: number;      // incremented immediately before each key comparison
  moves: number;            // each write into the ordering
  recursiveCalls: number;
  maxDepth: number;         // deepest level, 0-based
  levels: number;           // maxDepth + 1
  elapsedMs: number;        // sort loop only
  peakAuxElements: number;  // one buffer, allocated lazily
}
```

Rules enforced by review:

* no metric is ever computed by a formula in the UI — it is read from `metrics`;
* the tree is pushed during recursion, never reconstructed afterwards;
* the player never sorts — it replays;
* `Array.prototype.sort` appears exactly once, in the benchmark baseline, and is labelled.

## Decisions worth defending in a viva

| Decision | Why |
| --- | --- |
| Sort **indices**, not records | Small transfer, meaningful "moves" metric, text stays on the main thread. |
| **Web Worker** | 200k–1M records must not freeze the tab; a frozen UI during a demo is the worst possible look. |
| **No chart or UI library** | ~90 kB saved and full control of the visual language; the charts are ~150 lines of SVG. |
| **Plain CSS with tokens** | Light and dark are real themes, every colour is a variable, one file to audit. |
| **Capture caps, not throws** | Above the caps we degrade to aggregates instead of refusing to run; the metrics stay exact. |
| **Same comparator everywhere** | Multi-key, direction and missing-value semantics cannot diverge between UI, worker, CLI and tests. |
| **Timings best-of-k** | Browsers clamp `performance.now()` to ~100 µs; a single run of 100 records can read 0. |

## Extension points

* **External merge sort** — add `core/externalSort.ts` that chunk-sorts with `mergeSortIndices` and
  k-way merges runs; the UI needs one more panel, the worker one more message type.
* **New key types** — extend `KeyKind` and `buildComparator`; everything downstream consumes series.
* **New datasets** — add a generator to `data/samples.ts`; the sample grid picks it up.
* **Themes** — edit `src/styles/tokens.css` only.
