# Viva preparation

Twenty-six questions an examiner can reasonably ask about this project, with answers and — more
importantly — **where to point on screen or in the code**. The in-app **Theory → Viva questions**
accordion contains the first twenty.

---

## Correctness

**1. Walk me through merge sort in three lines.**
Split the range at the midpoint, sort both halves recursively, merge the two sorted runs by walking
two pointers and always taking the smaller head. Base case: a run of length 0 or 1.
→ `src/core/mergesort.ts`, `sortRange` + `mergeRange`.

**2. How do you know your output is correct?**
Two independent reasons: the 49-test suite compares against a reference sort on 13 sizes plus
adversarial inputs, and the Workbench lets you flip between *Sorted* and *Original* on a real file.
→ `tests/mergesort.test.ts`, `npm test`.

**3. What is the merge step doing, exactly?**
Copying the range into the auxiliary buffer, then merging back into the array: `i` walks the left
run, `j` the right run, `k` the output. Each iteration writes one element and advances one pointer;
the drain loops need no comparisons because one run is already exhausted.
→ Recursion Tree screen, "Compare aux[i] with aux[j]…" steps.

**4. Why compare `<= 0` rather than `< 0`?**
On a tie we take from the left run, whose elements all have smaller original positions. That is
precisely what makes the sort stable. With `< 0` the algorithm is still correct but unstable.
→ `mergeRange`, one line, with a comment; Stability panel.

**5. How many comparisons does it make?**
Best case `n·⌈log₂n⌉ − 2^⌈log₂n⌉ + 1`, worst case `n·⌈log₂n⌉ − n + 1`, and in practice about
`0.9 · n·log₂n` on random data. Our measured ratios are 0.81 → 0.94 as n grows.
→ Complexity Lab, "cmp / n·log₂n" column.

**6. Prove the recursion tree has 2n − 1 nodes.**
A full binary tree with `n` leaves has `n − 1` internal nodes, so `n + (n − 1) = 2n − 1`. Verified
by a test for n ∈ {1, 2, 5, 16, 17, 64, 100}.
→ `tests/mergesort.test.ts`, "builds a recursion tree with exactly 2n − 1 nodes".

**7. Why does the depth equal ⌈log₂n⌉ and not log₂n?**
With an odd size the halves are `⌊n/2⌋` and `⌈n/2⌉`, so one branch is longer. The longest branch
still needs `⌈log₂n⌉` halvings to reach size 1. Tested for every n from 1 to 64 and checked live
against the ⌈log₂n⌉ column.
→ Complexity Lab depth column; `theoreticalDepth()`.

**8. What happens with duplicate keys?**
Equal primary keys fall through to the secondary key; if that is also equal, the original position
decides. The Stability panel counts the tie pairs and verifies zero reorderings on the real output.

---

## Theory

**9. State and solve the recurrence.**
`T(n) = 2T(n/2) + Θ(n)`, `T(1) = Θ(1)`. Expanding: level `d` has `2^d` nodes costing `c·n/2^d`
each, i.e. `cn` per level; there are `log₂n + 1` levels; total `Θ(n log n)`.

**10. Which Master Theorem case is it?**
Case 2: `a = 2`, `b = 2`, `f(n) = Θ(n)` and `n^(log_b a) = n^1`, so `f(n)` is the same order as
the watershed function and `T(n) = Θ(n log n)`.

**11. Best case?**
`Θ(n log n)`. A favourable input reduces comparisons inside a merge but never removes a level, so
the growth rate is unchanged.

**12. Space complexity, and could you make it in place?**
`Θ(n)` for the buffer plus `Θ(log n)` for the stack. In-place merging exists (rotations, block
merge) but costs `Θ(n²)` or `Θ(n log n)` data movement, so it trades the advantage away. The
Workbench reports the measured buffer size.

**13. Why is the tree depth the call-stack depth?**
The recursion tree is the call history; the stack is one root-to-leaf path through it. Maximum tree
depth = maximum stack depth = `⌈log₂n⌉`, which is why the stack term is `Θ(log n)`.

**14. Divide-and-conquer or decrease-and-conquer?**
Divide and conquer: two independent subproblems of the same size and kind, combined by a merge.
Binary search would be decrease-and-conquer (one subproblem).

**15. Where does the `log` come from, physically?**
From the number of halvings needed to go from one problem of size `n` to `n` problems of size 1.
Each halving is a level, and each level pays for a full pass over the data.

---

## Design and implementation choices

**16. Why does the worker sort indices instead of records?**
A permutation is two typed arrays; the records (with their text) stay on the main thread. A 200,000
row sort then transfers 800 kB of indices instead of tens of megabytes of objects, and the "moves"
metric becomes meaningful — a move is a write into the ordering.

**17. Why allocate the auxiliary array once?**
Allocating per merge would add `Θ(n log n)` allocation traffic. One buffer of size `n`, reused,
matches the `Θ(n)` bound and is much faster.

**18. How is the animation step-back possible if you never re-run the algorithm?**
The run records an event stream (`split`, `copy`, `cmp`, `write`, `merged`). The player replays it
and rebuilds both arrays at each step, so scrubbing is pure and cheap. The player contains no
sorting logic at all.
→ `src/core/playback.ts`.

**19. Why cap the tree at 64 elements?**
Because 2n−1 nodes at n = 1,000,000 is 2 million rectangles — useless as a diagram. Above the cap
the tool keeps exact per-level aggregates and skips the node graph. The cap is a rendering
decision, not an algorithmic one.

**20. Why not just call `Array.prototype.sort`?**
Because the assignment is to demonstrate merge sort. The native call appears only as a labelled
baseline in the Complexity Lab — and it is TimSort, which is itself a merge sort variant, which is
a good talking point.

**21. What about quicksort?**
Implemented in `src/core/quicksort.ts` with Lomuto partitioning, deliberately, to demonstrate two
things on identical data: it is unstable, and it degrades to `Θ(n²)` on ascending input. The
Complexity Lab refuses to run it above 20,000 records in that case — a guard rail, stated on screen.

**22. How do you keep the numbers honest?**
Counters are incremented inside the algorithm, before each comparison; there is no estimation
anywhere. The only modelled value is the *reference curve* `n·log₂n`, which is drawn dashed and
labelled as fitted. Timings are best-of-k repetitions because browsers clamp `performance.now()`.

**23. What happens if I drop a 5 MB log in?**
It parses to records (multi-line events kept together), sorts in the worker in well under a second
at ~200k records, and the table virtualises so scrolling stays smooth. The 200k sample is included
to demo exactly that.

**24. What breaks with a malformed CSV?**
Nothing catastrophic: ragged rows are kept with blanks and counted, an unterminated quote keeps the
remaining text with a warning, BOM/CRLF/embedded newlines are handled. Each case has a test.
→ `tests/parse.test.ts`; the "hostile CSV" sample in the app.

**25. Why is the whole app client-side?**
Privacy (log files often contain customer data), zero deployment cost, and it works on a lab PC
with no internet. The trade-off is a memory ceiling around a few hundred thousand records.

**26. What would you do with another week?**
External merge sort (chunk into RAM-bounded runs, k-way merge) so multi-GB files work, and a
side-by-side "same file, both algorithms" view for the report.

---

## If they ask "what did *you* build?"

> A client-side workbench that parses log and CSV files into records, sorts them with a
> hand-written instrumented merge sort inside a Web Worker, and visualises the recursion tree,
> per-level cost and measured comparison count — with a CLI that reuses the same algorithm module,
> and a test suite that pins the invariants the write-up claims.
