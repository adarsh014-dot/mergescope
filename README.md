# MergeScope

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![tests](https://img.shields.io/badge/tests-49%20passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

**Sort large log files and CSV records with a hand-written merge sort — and watch the recursion tree that did it.**

MergeScope is a browser workbench for a classic DAA Unit‑1 assignment: implement merge sort,
apply it to a real file-sorting problem, and explain its cost with the recursion-tree method.
Everything you see is measured at runtime by counters inside the algorithm. Nothing is faked.

```
Θ(n log n) time, all inputs   ·   Θ(n) auxiliary space   ·   stable   ·   2n − 1 tree nodes
```

---

## What it actually does

Drop in a `.log` or `.csv` file and MergeScope:

1. **Parses it into records, not lines.** A stack trace stays glued to the ERROR above it; CSV is
   read with a real RFC‑4180 parser (quoted commas, embedded newlines, CRLF, BOM, ragged rows).
2. **Sorts it with `src/core/mergesort.ts`** — top-down, recursive, instrumented, written from
   scratch. `Array.prototype.sort` is never used to produce your output.
3. **Shows the cost.** Comparisons, writes, recursion depth, aux memory and wall time, plus the
   recorded recursion tree with a step-by-step replay.
4. **Hands the result back.** Download the sorted file and a `metrics.json` report you can attach
   to your write-up.

Your file never leaves the machine: parsing happens in the tab, sorting happens in a Web Worker,
and there is no backend at all.

---

## Quick start

Requires Node.js 20+ (built and tested on Node 24).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
npm test         # 49 unit tests
```

A normal terminal on Windows/macOS/Linux works. No environment variables, no accounts, no network
calls at runtime.

**For the live demo**, the incident log is also the first built-in sample — click *incident log (demo)*
in the Source panel, no file picker needed. The same file is on disk at
`sample-data/incident-2024-05-01.log` and that folder also has `DEMO.md`, a 5-minute script with the
exact numbers to read out.

---

## The five screens

| Screen | What it proves |
| --- | --- |
| **Workbench** | Load → parse → sort → inspect. Key selector, direction, live metrics, virtualised table (200k rows scroll smoothly), stability proof, exports. |
| **Recursion Tree** | Real recorded tree (splits, comparisons, writes, merges) with play/pause, single-step, 0.25×–8× speed, node inspector and the per-level cost table. |
| **Complexity Lab** | Measured comparisons and time at n = 100 … 50,000 plotted against a fitted `n·log₂n` reference on log-log axes, plus a 1,000,000-record stress test. |
| **Theory** | `T(n) = 2T(n/2) + Θ(n)`, the tree expansion, Master Theorem case 2, the space and stability proofs, and 20 viva questions with answers. |
| **CLI & docs** | The exact commands to run the site, the tests, and the Node CLI. |

---

## Measured results (this machine, this build)

| n | merge comparisons | cmp / (n·log₂n) | measured depth | ⌈log₂n⌉ | merge time | quicksort comparisons |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 539 | 0.81 | 7 | 7 ✓ | < 1 ms | 655 |
| 500 | 3,844 | 0.86 | 9 | 9 ✓ | < 1 ms | 5,551 |
| 2,000 | 19,379 | 0.88 | 11 | 11 ✓ | 0.7 ms | 23,777 |
| 10,000 | 120,453 | 0.91 | 14 | 14 ✓ | 4.2 ms | 141,844 |
| 50,000 | 718,044 | 0.92 | 16 | 16 ✓ | 25.8 ms | 888,324 |
| 200,000 (real log file) | 3,272,400 | 0.93 | 18 | 18 ✓ | 142.6 ms | — |
| 1,000,000 (stress) | 18,675,115 | 0.94 | — | 20 | 782.5 ms | skipped (would be Θ(n²)) |

Two conclusions fall straight out of the table:

* the ratio `comparisons / (n·log₂n)` settles near a constant → the growth rate is `Θ(n log n)`;
* measured depth equals `⌈log₂n⌉` at every size → the recursion tree has exactly the height the
  recurrence predicts.

---

## Command line

The CLI imports the same `src/core/mergesort.ts`. There is no second implementation.

```bash
node cli/index.ts access.log --key time --limit 10
node cli/index.ts app.log --key severity --then time
node cli/index.ts transactions.csv --key col:amount --order desc --json
node cli/index.ts access.log --key time --out sorted.log
```

Flags: `--key`, `--then`, `--order asc|desc`, `--limit`, `--out`, `--json`, `--help`.
Keys for logs are `time`, `severity`, `source`, `message`, `line`; for CSV they are
`col:<column-name>`.

```
MergeScope  tmp/access.log
────────────────────────────────────────────────────────────────────────
  400 log records · key time · ascending
  comparisons 2,961 · moves 3,488 · depth 9 (theory ⌈log₂n⌉ = 9) · 1.3 ms
  auxiliary buffer 400 elements · Θ(n) space · stable
```

---

## Architecture

```
src/
  core/            # pure algorithms — no DOM, no React, unit-tested
    mergesort.ts   #   the instrumented top-down merge sort
    quicksort.ts   #   Lomuto quicksort: the unstable Θ(n²)-worst-case contrast
    keys.ts        #   key projection + the shared comparator
    playback.ts    #   replays recorded events into frames (no sorting logic)
    stability.ts   #   proves stability on the actual output permutation
    types.ts       #   metrics / event / tree contracts
  parse/           # CSV + log readers, format detection, key series
  workers/         # sort.worker.ts runs every sort off the main thread
  components/      # panels, table, chart, tree player, primitives
  views/           # Workbench, Tree, Complexity, Theory, CLI
  data/            # seeded sample generators
  lib/             # formatting + export helpers
cli/index.ts       # the same sorter, in a terminal
tests/             # 49 assertions: correctness, invariants, parsers, replay
```

Data flow for one sort:

```
file ──parse──▶ records + columns
                    │
                    ▼
        buildKeySeries(primary, secondary)      # Float64Array | string[]
                    │
                    ▼
        Web Worker ──▶ mergesort.ts ──▶ { order, metrics, tree, events, levels }
                    │
                    ▼
     table (order) · metrics rail · tree player (events) · exports
```

The worker receives **key series**, not records: the UI keeps the text, the algorithm only sees
numbers or strings, and a 200,000-row sort never copies objects across a thread boundary.

### Instrumentation contract

```ts
type SortMetrics = { comparisons; moves; recursiveCalls; maxDepth; levels; elapsedMs; peakAuxElements };
type TreeNode   = { id; lo; hi; depth; parentId; size; comparisons; order };
type SortEvent  = { t: 'split' | 'copy' | 'cmp' | 'write' | 'merged'; … };
```

Counters are incremented *inside* the merge loop, immediately before each key comparison. The tree
is pushed as the recursion happens. The player holds no sorting logic — it replays events.

Deliberate caps, so the tab stays alive: the tree is recorded up to 65,536 records and the event
stream up to 64 records (2n−1 = 127 nodes is about the limit of a readable diagram). Above those,
per-level aggregates are still exact.

---

## Tests

```bash
npm test
```

```
Test Files  2 passed (2)
     Tests  49 passed (49)
```

Covered: reference-equivalence on 13 sizes, empty/single/duplicate/already-sorted/reverse inputs,
stability (equal keys, secondary keys, missing keys), `depth == ⌈log₂n⌉` for n = 1…64, tree node
count `2n−1`, every level above the deepest touching exactly n elements, node comparisons summing
to the global count, comparison bounds, playback fidelity, and 15 parser edge cases.

---

## Rubric map

| Criterion | Where it is demonstrated |
| --- | --- |
| Correctness | `src/core/mergesort.ts`, 49 tests, stability panel verifying the real output permutation |
| Robustness | 200k-record sample, 1M stress test, the hostile-CSV sample, every parser edge case tested, guarded quicksort budget |
| UI / CLI | Five-screen app + `cli/index.ts`; keyboard focus rings, live regions, empty/error states |
| Practical application | Real log/CSV in, sorted file + metrics report out; multi-line events preserved; duplicate timestamps keep file order |
| Theoretical grounding | Theory screen, `THEORY.md`, measured-vs-theoretical table computed from actual runs |
| Code structure | `core` / `parse` / `workers` / `components` / `views` split, JSDoc on every export, `ARCHITECTURE.md` |
| Understanding | `VIVA.md`, in-app viva accordion, step narrator and node inspector explaining the live algorithm |

---

## Known limits (stated, not hidden)

* **No external merge sort.** Chunk-and-merge for files larger than RAM is described in the Theory
  screen as the real-world motivation, but it is not implemented. The browser can hold a few
  hundred thousand records comfortably; a 2 GB log is out of scope.
* **Timestamps**: ISO‑8601, nginx/Apache bracketed CLF, and `YYYY-MM-DD HH:MM:SS`. Syslog lines
  without a year are not parsed as dates (they sort last, deterministically).
* **Animation cap**: the tree player replays up to 32 records by choice — 2n−1 nodes beyond that is
  not a useful picture. The metrics path itself has no such limit.
* **Timing granularity**: browsers clamp `performance.now()` to ~100 µs, so benchmark times are the
  best of k repetitions. Comparison counts are exact integers and are the primary evidence.

---

## Licence / attribution

Released under the **MIT Licence** — see [LICENSE](LICENSE).

Written from scratch for coursework. No third-party UI, chart or sorting library is used at
runtime; the only dependencies are React, Vite and TypeScript (development).
