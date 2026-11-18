# Demo script — `incident-2024-05-01.log`

A 12-minute payment-outage window from a fictional system, deliberately shuffled so it is **not**
in timestamp order. Every number below was measured with this exact file.

```
537 lines  →  512 records  (9 of them are multi-line: stack traces + context)
61 ERROR · 64 WARN · 156 DEBUG · 231 INFO  ·  2 records with no timestamp at all
27 groups of records sharing the same millisecond (largest group: 4)
```

Why 512 matters: `log₂512 = 9`, so the recursion tree has **depth 9, 10 levels and 2n−1 = 1023
nodes** — clean numbers to say out loud next to the recurrence.

---

## 1. Load it (30 s)

Drag the file onto **Workbench → Source**, or use *Choose file*.

Say: *"537 lines, but 512 records — the parser attaches stack-trace lines to the ERROR above them,
so a record is an event, not a line. Two lines have no timestamp at all; they sort last."*

## 2. Sort by timestamp (1 min)

Default key, ascending. Point at the right rail:

| Readout | Value | What to say |
| --- | --- | --- |
| Comparisons | **3,980** | measured inside the merge loop, not estimated |
| Recursion depth | **9** | `⌈log₂512⌉ = 9` — the tree height the recurrence predicts |
| Aux memory | **512 elems** | one buffer, `Θ(n)` — merge sort is not in place |
| Time | ~2 ms | |

Then hit **Original** in the table to show the file really was out of order.

## 3. Recursion tree (1–2 min)

**Recursion Tree** tab → play, then step once or twice, then click a node.

Say: *"This tree is recorded during the run — every node is a real recursive call. The bars are the
array, the dashed row is the auxiliary buffer, and the level table shows every level touching
`n = 512` elements, which is why the total is `n · log₂n`."*

## 4. The stability demo (the strongest 60 seconds)

Workbench → set **Primary = severity**, **Then by = timestamp**.

| Readout | Value |
| --- | --- |
| Equal-key pairs | 19 |
| **Merge sort reorders** | **0** |
| **Quicksort reorders** | **9** |

Say: *"Same data, same comparator. Lomuto quicksort put 9 equal-severity, equal-millisecond pairs
out of file order; merge sort put none out of order — because ties take the left run. That is why
'severity, then time' is safe here and not with an unstable sort."*

## 5. Complexity lab (1 min)

**Complexity lab** → toggle **Already sorted**, then **Re-run**.

Say: *"A pre-sorted log is quicksort's worst case — its line dives into the Θ(n²) corner. Merge sort
barely changes, because it is Θ(n log n) in every case. The ratio column sitting near a constant is
the empirical proof of `n·log₂n`."*

## 6. Export (20 s)

**Export → metrics.json**. Open it: it contains the recurrence, measured depth vs `⌈log₂n⌉`,
comparison ceiling check and per-level costs — attach it to the report.

CLI equivalent, if they ask:

```bash
node cli/index.ts sample-data/incident-2024-05-01.log --key time --limit 5
node cli/index.ts sample-data/incident-2024-05-01.log --key severity --then time --json
```

---

## Likely questions about this file

* **"Why is the first line 09:24 and the second 09:20?"** — the export was collected from five hosts
  and merged without sorting. That is the problem the tool solves.
* **"What are the two timestamp-less lines?"** — collector notes (`WARN collector gap…`,
  `INFO log rotated…`). Missing keys sort last, deterministically, and keep their relative order.
* **"512 records — is that realistic?"** — a 12-minute window of a small service, yes. The same code
  path handles 200,000 records (built-in sample) and 1,000,000 (Complexity Lab).
* **"Can I break it?"** — load the built-in **hostile CSV** sample (BOM, CRLF, quoted commas,
  embedded newlines, ragged row) or paste garbage; you get a warning, never a crash.
