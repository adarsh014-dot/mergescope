/**
 * Theory view — the write-up, in the app, next to the thing it describes.
 *
 * Every claim here is exercised by the Workbench or the Complexity Lab, which is
 * what makes it defensible in a viva.
 *
 * @module views/TheoryView
 */

import { Panel } from '../components/ui.tsx';
import { useApp } from '../state/AppState.tsx';

const VIVA: { q: string; a: string }[] = [
  {
    q: 'Why does merge sort split exactly in the middle?',
    a: 'A balanced split gives two subproblems of size ≈ n/2, so the recurrence is T(n) = 2T(n/2) + Θ(n). Splitting unevenly (say n−1 and 1) would give T(n) = T(n−1) + Θ(n) = Θ(n²). The balance is what buys the log factor.',
  },
  {
    q: 'Solve T(n) = 2T(n/2) + Θ(n) and show where it comes from.',
    a: 'Expanding the recursion tree: level 0 costs cn, level 1 has 2 nodes costing c·n/2 each = cn, level d costs cn. There are log₂n + 1 levels, so total = cn·(log₂n + 1) = Θ(n log n).',
  },
  {
    q: 'Why is the merge step Θ(n)?',
    a: 'Two pointers each advance monotonically over the n elements. Every iteration writes exactly one element and advances one pointer, so there are at most n iterations plus n copies from the auxiliary buffer. That is linear work per node.',
  },
  {
    q: 'Space complexity — and why can it not be O(1)?',
    a: 'Θ(n) for the auxiliary buffer plus Θ(log n) for the call stack. Merging two sorted runs cannot be done in place without quadratic data movement (there are rotation-based tricks, but they trade time for space), so the buffer is what makes the linear merge possible.',
  },
  {
    q: 'Prove merge sort is stable.',
    a: 'Induction on size. Assume both halves are sorted stably. In the merge, when keys are equal we take from the LEFT run (the `<= 0` branch in mergesort.ts). Elements of the left run all have smaller original positions than elements of the right run, so equal keys keep their original relative order. Hence the whole array is stable.',
  },
  {
    q: 'What exactly breaks if you use `< 0` instead of `<= 0`?',
    a: 'On a tie the algorithm takes the right element first, which reverses the original order of equal keys. The sort is still correct, but no longer stable — and the "sort by severity, then by timestamp" use case silently loses information.',
  },
  {
    q: 'Best-case comparisons — is merge sort ever faster than Θ(n log n)?',
    a: 'No. Every level still merges all n elements; a lucky input only avoids some comparisons inside the merge (when one run is entirely smaller than the other). The measured best case is still Θ(n log n) — the Workbench shows the count dropping slightly but the growth rate holding.',
  },
  {
    q: 'Why is merge sort the standard choice for external sorting (files bigger than RAM)?',
    a: 'Merging only ever reads forward from two sorted runs, so it is sequential access — ideal for disks. You sort RAM-sized chunks, write them out as runs, then k-way merge. Quicksort needs random access and does not compose this way.',
  },
  {
    q: 'Then why is quicksort usually faster in practice?',
    a: 'Cache locality and no allocation: quicksort partitions in place, so it touches memory it already has in cache. Merge sort streams through an auxiliary array. The asymptotic winner is not the constant-factor winner — which is why the native Array.prototype.sort is TimSort (a merge sort hybrid) and not quicksort.',
  },
  {
    q: 'Is the recursion depth exactly log₂n?',
    a: 'It is ⌈log₂n⌉ for n > 1. With an odd size the halves are ⌊n/2⌋ and ⌈n/2⌉, so one branch is deeper; the deepest branch is still ⌈log₂n⌉. The Complexity Lab checks the measured depth against ⌈log₂n⌉ at every size.',
  },
  {
    q: 'How many nodes does the recursion tree have?',
    a: '2n − 1. A binary tree where every internal node has exactly two children and there are n leaves has n − 1 internal nodes, so n + (n − 1) = 2n − 1.',
  },
  {
    q: 'Where do the comparison counts in the UI come from?',
    a: 'A counter incremented inside the merge loop, immediately before each key comparison. Copies from the auxiliary buffer and the drain loops are counted as moves, not comparisons — that is why the two numbers differ.',
  },
  {
    q: 'What happens with duplicate keys?',
    a: 'They are ordered by the tie rule: equal primary keys fall through to the secondary key, and if that is also equal the original position decides (stability). The Workbench has a dedicated stability panel that verifies this on the real output and compares it with quicksort.',
  },
  {
    q: 'Worst-case input for this implementation?',
    a: 'There is no pathological input: merge sort is Θ(n log n) for every permutation. Reverse-sorted data costs slightly more comparisons than pre-sorted data, but the growth rate is identical. That is the opposite of Lomuto quicksort, which is Θ(n²) on sorted input.',
  },
  {
    q: 'Why allocate the auxiliary array once?',
    a: 'Allocating n elements per merge would cost Θ(n log n) allocation traffic. One buffer of size n, reused for every merge, is both the correct Θ(n) space bound and much faster.',
  },
  {
    q: 'Why cap the animation at 64 elements if the tool handles a million?',
    a: 'The cap is a rendering decision, not an algorithmic one. A 1,000,000-element tree has 2n − 1 ≈ 2 million nodes; drawing that is meaningless. Above the cap the tool records per-level aggregates instead, and the metrics stay exact.',
  },
  {
    q: 'How is the recursion tree related to the call stack?',
    a: 'They have the same shape: the tree is the call history, and the stack is one root-to-leaf path through it. Maximum tree depth = maximum stack depth = ⌈log₂n⌉, which is why the stack cost is Θ(log n), not Θ(n).',
  },
  {
    q: 'What is TimSort and why does native sort beat this implementation?',
    a: 'TimSort is a stable, adaptive merge sort that detects existing runs and merges them. It is compiled and hand-optimised, and real logs are full of partial order, so it wins on constant factors. The chart plots it as a baseline to show that the Θ(n log n) shape is shared.',
  },
  {
    q: 'Is this a divide-and-conquer algorithm or a decrease-and-conquer one?',
    a: 'Divide and conquer: the problem splits into two independent subproblems of the same kind, each is solved recursively, and the results are combined in the merge step. Decrease-and-conquer would shrink to one subproblem (like binary search).',
  },
  {
    q: 'What did you actually build, in one sentence?',
    a: 'A browser tool that parses a log or CSV file into records, sorts them with a hand-written instrumented merge sort inside a worker, and visualises the real recursion tree, per-level cost and comparison count — with exports for the sorted file and the measurements.',
  },
];

const COMPARISON = [
  { alg: 'Merge sort', best: 'Θ(n log n)', avg: 'Θ(n log n)', worst: 'Θ(n log n)', space: 'Θ(n)', stable: 'yes' },
  { alg: 'Quicksort (Lomuto)', best: 'Θ(n log n)', avg: 'Θ(n log n)', worst: 'Θ(n²)', space: 'Θ(log n)', stable: 'no' },
  { alg: 'Heapsort', best: 'Θ(n log n)', avg: 'Θ(n log n)', worst: 'Θ(n log n)', space: 'Θ(1)', stable: 'no' },
  { alg: 'Insertion sort', best: 'Θ(n)', avg: 'Θ(n²)', worst: 'Θ(n²)', space: 'Θ(1)', stable: 'yes' },
];

export function TheoryView() {
  const { setView } = useApp();

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="stack">
        <Panel index="T1" title="The recurrence">
          <div className="prose">
            <p>
              Merge sort partitions the array into two halves, sorts each half recursively, then
              merges the two sorted halves in linear time. That sentence <em>is</em> the recurrence:
            </p>
            <div className="formula">
              T(n) = 2·T(n/2) <span className="c">// two half-size subproblems</span>
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ Θ(n) <span className="c">// the merge pass</span>
              <br />
              T(1) = Θ(1) <span className="c">// a single element is sorted</span>
            </div>
            <h3>Expanding it as a tree</h3>
            <p>
              Draw the recursion as a tree. The root costs <span className="mono">cn</span> for the
              merge of the whole array. Its two children each cost{' '}
              <span className="mono">c·(n/2)</span>, so that level also costs{' '}
              <span className="mono">cn</span>. This repeats: <strong>every level costs cn</strong>.
            </p>
            <div className="formula">
              level 0 &nbsp; <span className="h">cn</span> &nbsp;&nbsp;&nbsp; 1 node &nbsp;&nbsp; size n<br />
              level 1 &nbsp; <span className="h">cn</span> &nbsp;&nbsp;&nbsp; 2 nodes &nbsp; size n/2 each<br />
              level 2 &nbsp; <span className="h">cn</span> &nbsp;&nbsp;&nbsp; 4 nodes &nbsp; size n/4 each<br />
              &nbsp;…<br />
              level log₂n &nbsp; <span className="h">cn</span> &nbsp; n nodes &nbsp; size 1 each<br />
              <span className="c">────────────────────────────────────</span>
              <br />
              total = cn · (log₂n + 1) = <span className="h">Θ(n log n)</span>
            </div>
            <h3>By the Master Theorem</h3>
            <p>
              With <span className="mono">a = 2</span>, <span className="mono">b = 2</span> and{' '}
              <span className="mono">f(n) = Θ(n)</span>, we compare{' '}
              <span className="mono">f(n)</span> with{' '}
              <span className="mono">n^(log_b a) = n^1</span>. They are the same order, so this is
              case 2:
            </p>
            <div className="formula">
              T(n) = Θ(n^(log₂2) · log n) = <span className="h">Θ(n log n)</span>
            </div>
            <p>
              Best, average and worst case are all Θ(n log n): the split is always balanced and the
              merge always touches every element, regardless of the input order.
            </p>
          </div>
        </Panel>

        <Panel index="T2" title="Space, stability and the small print">
          <div className="prose">
            <h3>Space: Θ(n), and that is a real cost</h3>
            <p>
              The merge needs somewhere to hold a copy of the range being merged, so the algorithm
              allocates one auxiliary buffer of n elements — reused for every merge. Add the call
              stack, which reaches ⌈log₂n⌉ frames, and the total is{' '}
              <strong>Θ(n) extra space</strong>. Merge sort is <em>not</em> in place. The Workbench
              reports the measured buffer size so the claim is visible, not asserted.
            </p>
            <h3>Stability: why it matters for logs</h3>
            <p>
              Merge sort is stable because equal keys always take the element from the{' '}
              <strong>left</strong> run. Left-run elements all have smaller original positions, so
              their relative order survives the merge. That is the entire proof, and it is one
              character of code: <span className="mono">cmp(left, right) &lt;= 0</span>.
            </p>
            <p>
              Practically: sort by severity, then by timestamp, and every ERROR from the same
              millisecond stays in the order it appeared in the file. The stability panel verifies
              this on the actual output and shows quicksort failing the same check.
            </p>
            <h3>Where merge sort loses</h3>
            <ul>
              <li>
                <strong>Memory:</strong> Θ(n) copies is painful when n is a large fraction of RAM.
              </li>
              <li>
                <strong>Cache behaviour:</strong> the auxiliary buffer means twice the memory traffic
                of an in-place partition.
              </li>
              <li>
                <strong>Small arrays:</strong> insertion sort beats it below ~16–32 elements, which is
                why real implementations switch to it at the base case.
              </li>
              <li>
                <strong>Linked lists:</strong> here merge sort wins outright — no random access
                needed, and merging is pointer rewiring.
              </li>
            </ul>
          </div>
        </Panel>

        <Panel index="T3" title="Viva questions" bodyClassName="panel-body">
          <p className="small muted" style={{ marginBottom: 8 }}>
            Twenty answers, each pointing at the part of the app or code that demonstrates it.
          </p>
          {VIVA.map((item, i) => (
            <details className="qa" key={i}>
              <summary>{item.q}</summary>
              <div>{item.a}</div>
            </details>
          ))}
        </Panel>
      </div>

      <div className="rail" style={{ position: 'static' }}>
        <Panel index="T4" title="Against the field" bodyClassName="panel-body tight">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Best</th>
                  <th>Worst</th>
                  <th>Space</th>
                  <th>Stable</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.alg} style={row.alg.startsWith('Merge') ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>{row.alg}</td>
                    <td className="num">{row.best}</td>
                    <td className="num">{row.worst}</td>
                    <td className="num">{row.space}</td>
                    <td className="num" style={{ color: row.stable === 'yes' ? 'var(--ok)' : 'var(--err)' }}>
                      {row.stable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <span className="xs dim">All four are implemented and measured in the Complexity Lab.</span>
          </div>
        </Panel>

        <Panel index="T5" title="Where to look in the code">
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>
              <span className="mono">src/core/mergesort.ts</span> — the algorithm + counters
            </li>
            <li>
              <span className="mono">src/core/quicksort.ts</span> — the unstable contrast
            </li>
            <li>
              <span className="mono">src/core/playback.ts</span> — event replay, no sort logic
            </li>
            <li>
              <span className="mono">src/core/stability.ts</span> — the stability check
            </li>
            <li>
              <span className="mono">src/workers/sort.worker.ts</span> — off-main-thread sorting
            </li>
            <li>
              <span className="mono">THEORY.md</span> — this page as a document
            </li>
          </ul>
          <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setView('complexity')}>
            See the measured version →
          </button>
        </Panel>

        <div className="callout">
          <b>One-line summary for the examiner.</b>
          <p>
            Balanced split → 2 subproblems of n/2 → linear merge → every level costs n → log₂n levels
            → Θ(n log n) time, Θ(n) space, stable.
          </p>
        </div>
      </div>
    </div>
  );
}
