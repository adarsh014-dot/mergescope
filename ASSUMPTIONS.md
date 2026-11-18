# Assumptions and scope decisions

Recorded so nothing in the delivery is a silent surprise. Each item is a decision made during the
build, with the reasoning and — where relevant — how to reverse it.

## Scope

1. **No external merge sort.** Chunked run-generation + k-way merge for files larger than memory is
   described as the real-world motivation (Theory screen, viva Q&A) but not implemented. The in-app
   ceiling is a few hundred thousand records. Reversal: `core/externalSort.ts` + one worker message.
2. **Browser-only product.** No server, no database, no upload, no auth. This is a stated feature
   (privacy, works offline), not a missing piece.
3. **No team page or member names.** The structure/write-up is presented as a single-author build;
   `ARCHITECTURE.md` carries the module responsibility map instead of a team workload matrix.
4. **No deployment configuration.** Runs locally with `npm run dev`. `npm run build` produces a
   static `dist/` that can be hosted anywhere, but no host was configured.

## Algorithm

5. **Top-down (recursive) merge sort, not bottom-up.** The assignment is about the recursion tree, so
   the recursive form is the one that must be visible.
6. **One auxiliary buffer of `n`**, allocated on first merge and reused. A per-merge allocation would
   still be `Θ(n)` space but `Θ(n log n)` allocation traffic.
7. **`comparisons` counts only key comparisons inside the merge `while` loop.** Copying into `aux` and
   draining a run are counted as `moves`. This is the standard convention and is stated in the UI.
8. **`maxDepth` is 0-based**, so a single element has depth 0 and one level. The UI always shows both
   (`depth` and `tree levels`) to avoid the off-by-one argument.
9. **Stability rule: ties take the left run** (`<= 0`). Standard, and the only thing needed for the
   stability proof.
10. **Missing keys sort last in both directions** (`NaN` timestamps, empty CSV cells). Deterministic
    and documented rather than left to comparator accidents.
11. **Lomuto quicksort** (last-element pivot) is the contrast implementation, chosen because it
    demonstrably degrades on sorted input — which is the point being made.

## Parsing

12. **Timestamp formats supported**: ISO-8601 (with/without zone), nginx/Apache bracketed CLF, and
    `YYYY-MM-DD HH:MM:SS`. Syslog lines without a year are *not* parsed as dates.
13. **Format detection** uses the extension first (`.csv`/`.tsv` → CSV, `.log` → log); for anything
    else the content is sniffed for consistent commas/semicolons/tabs.
14. **A "record" is a new line that starts with a timestamp or a leading level token**; every other
    non-empty line is a continuation of the record above. This is what keeps stack traces intact.
15. **Ragged CSV rows are kept** (blanks filled) and counted as a warning, rather than dropped.
16. **All datasets are synthetic and seeded** (`mulberry32`). No real customer data is bundled, and
    the same seed always produces byte-identical input so measurements are reproducible.

## Rendering / measurement

17. **Recursion tree captured up to 65,536 records; event stream up to 64 records.** Above that the
    UI shows exact per-level aggregates. The animation deliberately defaults to 16 elements because
    that is what is readable on a projector.
18. **Benchmark sizes are 100, 500, 2,000, 10,000, 50,000** plus an explicit 1,000,000 stress test.
    Quicksort is skipped above 20,000 records on sorted input (it would hang the tab) — shown as
    "skipped" in the table, not silently omitted.
19. **Timings are best-of-k** (25 runs at n ≤ 500, 5 at n ≤ 5,000, 1 above) because browsers clamp
    `performance.now()` to roughly 100 µs. Comparison counts are exact and are the primary evidence.
20. **The `elapsedMs` shown in the Workbench includes the worker round-trip** (it is the maximum of
    the sort loop and the wall-clock wait), so the UI never claims a time faster than the user waited.

## Interface

21. **Dark is the default theme**; light is a fully tuned second theme, not an inversion.
22. **No external fonts or icon packs** — system font stacks and inline SVG, so the app works with no
    internet connection.
23. **No animation library** — CSS transitions plus a timer; the tree player's motion is driven by
    state, and `prefers-reduced-motion` is respected.
24. **The CLI requires Node 22.18+/24** because it runs TypeScript directly via type stripping. This
    keeps the CLI dependency-free and guarantees it shares the exact sorter module.
