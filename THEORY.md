# Theory — merge sort and the recursion-tree method

Everything below is demonstrated in the app: the **Theory** screen states it, the **Complexity
Lab** measures it, and the **Recursion Tree** screen shows it happening.

---

## 1. The algorithm

```
mergeSort(A, lo, hi):
    if hi - lo < 2: return            # 0 or 1 element is already sorted
    mid = (lo + hi) / 2
    mergeSort(A, lo, mid)             # sort the left half
    mergeSort(A, mid, hi)             # sort the right half
    merge(A, lo, mid, hi)             # merge two sorted runs in linear time

merge(A, lo, mid, hi):
    copy A[lo..hi) into aux
    i = lo, j = mid, k = lo
    while i < mid and j < hi:
        if cmp(aux[i], aux[j]) <= 0: A[k++] = aux[i++]
        else:                        A[k++] = aux[j++]
    drain the remaining run (no comparisons needed)
```

This is **divide and conquer** in the textbook sense: one problem splits into two independent
subproblems of the same kind, each is solved recursively, and the solutions are combined.

> In the app, open **Recursion Tree** — the diagram you see there is generated from a real run,
> not drawn by hand, and you can step through it.

---

## 2. The recurrence

The description above *is* the recurrence. Split costs `Θ(1)`, two subproblems cost `2T(n/2)`,
and merging costs `Θ(n)`:

```
T(n) = 2·T(n/2) + Θ(n)      for n > 1
T(1) = Θ(1)
```

### Solving it with the recursion tree

Draw one node per recursive call. The root merges `n` elements, so it costs `cn`.

| Level | Nodes | Elements per node | Cost of the level |
| --- | --- | --- | --- |
| 0 | 1 | n | cn |
| 1 | 2 | n/2 | 2 · c(n/2) = cn |
| 2 | 4 | n/4 | 4 · c(n/4) = cn |
| … | … | … | … |
| d | 2^d | n/2^d | cn |
| log₂n | n | 1 | cn |

**Every full level costs `cn`.** The tree bottoms out when the subproblems reach size 1, which
takes `log₂n` halvings, so there are `log₂n + 1` levels:

```
T(n) = cn · (log₂n + 1) = cn·log₂n + cn = Θ(n log n)
```

The graph is the argument: `n · ⌈log₂n⌉` total work, no term dominating, so `Θ(n log n)`.

In the app's **Cost per level** table you can watch `elements touched` stay equal to `n` on every
level above the deepest, with per-level comparisons summing to the measured total.

### By the Master Theorem

For `T(n) = a·T(n/b) + f(n)` with `a = 2`, `b = 2`, `f(n) = Θ(n)`:

```
n^(log_b a) = n^(log₂ 2) = n
f(n) = Θ(n)  ⟹  f(n) = Θ(n^(log_b a))     → case 2
⟹ T(n) = Θ(n^(log_b a) · log n) = Θ(n log n)
```

### Best, average, worst

All three are `Θ(n log n)`. The split is always at the midpoint (so the tree is always balanced)
and the merge always touches every element. A lucky input only reduces comparisons *inside* a
merge, when one run happens to be entirely smaller than the other — it never removes a level.
There is no pathological permutation, which is exactly what quicksort cannot say.

---

## 3. Space

```
auxiliary buffer : Θ(n)      one array of n elements, allocated once, reused by every merge
call stack       : Θ(log n)  one frame per level, ⌈log₂n⌉ deep
────────────────────────────
total extra      : Θ(n)
```

Merge sort is **not** in place. That is a genuine cost, not a footnote: it doubles memory traffic
compared with an in-place partition. Implementations that merge "in place" by rotation pay `Θ(n²)`
data movement instead, which defeats the purpose. The Workbench reports the measured buffer size
(`peakAuxElements`) so the claim is visible.

---

## 4. Stability (and why it matters here)

A sort is **stable** if records with equal keys keep their original relative order.

**Claim.** The merge above preserves the order of equal keys.

**Proof sketch** (induction on `n`).
Base case: a run of length 0 or 1 is trivially stable.
Inductive step: assume both halves are sorted stably. In `merge`, when `cmp(aux[i], aux[j]) == 0`
we take from the **left** run — the `<= 0` branch. Every element of the left run has a smaller
original index than every element of the right run (the halves are contiguous slices of the input).
So the left element must come first for the output to be stable, and it does. Every other pair is
decided by a strict comparison, which is unaffected. Hence the merged run is stable, and by
induction so is the whole array. ∎

The proof is one character of code: `<=` instead of `<`.

**Why the tool cares.** "Sort by severity, then timestamp" is the canonical log task. With an
unstable sort, two ERRORs from the same millisecond can swap places, and the file's ordering
information is destroyed. The **Stability** panel checks the real output permutation for
violations (equal neighbours whose original indices decreased) and runs Lomuto quicksort on the
same data as a control — quicksort fails that check, merge sort scores zero.

---

## 5. Against the field

| Algorithm | Best | Average | Worst | Extra space | Stable | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Merge sort** | Θ(n log n) | Θ(n log n) | Θ(n log n) | Θ(n) | yes | predictable; needs a buffer |
| Quicksort (Lomuto) | Θ(n log n) | Θ(n log n) | **Θ(n²)** | Θ(log n) | no | in place, cache friendly, fragile on sorted input |
| Heapsort | Θ(n log n) | Θ(n log n) | Θ(n log n) | Θ(1) | no | in place, poor locality |
| Insertion sort | Θ(n) | Θ(n²) | Θ(n²) | Θ(1) | yes | unbeatable under ~16–32 elements |
| TimSort (native) | Θ(n) | Θ(n log n) | Θ(n log n) | Θ(n) | yes | merge sort + run detection |

The Complexity Lab measures the first two and the native baseline on identical seeded data. Switch
to **Already sorted** and quicksort's line dives for the Θ(n²) corner while merge sort's stays on
the `n·log₂n` slope and its comparison count barely moves. That single picture is the argument for
using merge sort on log exports, which are frequently already ordered.

---

## 6. Why merge sort for logs and CSV files

* **Sequential access only.** Merging reads two runs forward. That is the property that makes
  *external* merge sort possible: sort RAM-sized chunks, write them out as runs, then k-way merge.
  Quicksort needs random access and does not compose this way.
* **No adversarial input.** A pre-sorted log is merge sort's normal case, not its worst case.
* **Stability.** Secondary keys (severity, host) stay meaningful.
* **Predictable memory.** One buffer of `n` elements, known in advance.

Where it loses: `Θ(n)` extra memory, worse cache behaviour than in-place partitioning, and a
larger constant than insertion sort on tiny runs (which is why real implementations switch to
insertion sort at the base case — TimSort does exactly that).

---

## 7. Measured, not asserted

From `npm run dev` on this machine (Chrome, Node 24):

| n | comparisons | cmp / (n·log₂n) | depth | ⌈log₂n⌉ | time |
| --- | --- | --- | --- | --- | --- |
| 100 | 539 | 0.81 | 7 | 7 | < 1 ms |
| 500 | 3,844 | 0.86 | 9 | 9 | < 1 ms |
| 2,000 | 19,379 | 0.88 | 11 | 11 | 0.7 ms |
| 10,000 | 120,453 | 0.91 | 14 | 14 | 4.2 ms |
| 50,000 | 718,044 | 0.92 | 16 | 16 | 25.8 ms |
| 200,000 | 3,272,400 | 0.93 | 18 | 18 | 142.6 ms |
| 1,000,000 | 18,675,115 | 0.94 | — | 20 | 782.5 ms |

The ratio column is the empirical test of `Θ(n log n)`: a constant ratio means the comparison count
grows exactly like `n log₂n`. The depth column is the empirical test of the tree: `⌈log₂n⌉` at
every size. Reproduce both from the app (Complexity Lab) or the CLI (`--json`).

---

## 8. One-paragraph answer for the examiner

> Merge sort splits the array at the midpoint, sorts both halves recursively and merges them in
> linear time, giving `T(n) = 2T(n/2) + Θ(n)`. Expanding that as a tree, each level costs `cn` and
> there are `log₂n + 1` levels, so the total is `Θ(n log n)` — the same in the best, average and
> worst case. It needs `Θ(n)` auxiliary space and `Θ(log n)` stack, and it is stable because ties
> take the left run. Our tool implements exactly that, measures the comparisons and depth at
> runtime, and draws the real recursion tree from the run.
