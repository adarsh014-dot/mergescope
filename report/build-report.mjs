/**
 * Builds the DAA Unit-1 project report as a .docx.
 *
 *   npm i -D docx        (once, anywhere — not part of the app's dependencies)
 *   node report/build-report.mjs                      # colour, with screenshots
 *
 * Variants (environment variables, nothing else changes):
 *   BW=1      monochrome — every accent, rule and table fill becomes black/grey
 *   SHOTS=0   drop the three application screenshots, keep the flowchart
 *   OUT=...   output file name inside report/
 *
 *   BW=1 SHOTS=0 OUT=MergeScope-Report-1.docx node report/build-report.mjs
 *
 * Edit META below for names / group / college, everything else is generated
 * from the measured numbers in README.md and the figures in report/figures/.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const MONOCHROME = process.env.BW === '1';
const SHOTS = process.env.SHOTS !== '0';
const OUT_FILE = process.env.OUT ?? 'MergeScope-Report.docx';

/** Flip to true to include the complexity-chart screenshot (adds ~⅓ page). */
const INCLUDE_CHARTS = process.env.CHARTS === '1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIG = path.join(HERE, 'figures');

/* ────────────────────────────────────────────────────────────────────────────
   Replace these four blocks. Everything else in the document is generated.
   ──────────────────────────────────────────────────────────────────────────── */
/**
 * Any of these may be left empty and the corresponding line simply disappears
 * from the title page — nothing prints as a blank field or a stray label.
 *   institution / department  the two lines above the course title
 *   group                     "Group ..." row
 *   guide                     "Submitted to ..." row
 *   members                   one row per member; roll may be omitted
 *   date                      prints alone when everything else is empty
 */
const META = {
  institution: '',
  department: 'Department of Computer Science & Engineering',
  course: 'Design and Analysis of Algorithms',
  unit: 'Unit 1 — Divide and Conquer, Merge Sort and the Recursion-Tree Method',
  title: 'MergeScope',
  subtitle: 'An interactive workbench that sorts real log files and shows the recursion tree behind the running time',
  group: '',
  guide: '',
  date: '23 November 2026',
  members: [],
};

/** "a · b · c", skipping anything empty. */
const join = (...parts) => parts.filter((x) => x && x.trim() !== '').join('  ·  ');

/* ── palette / typography ─────────────────────────────────────────────────── */
const INK = MONOCHROME ? '000000' : '14202B';
const MUTED = MONOCHROME ? '3D3D3D' : '5A6B78';
const ACCENT = MONOCHROME ? '000000' : '0F7F6E';
const RULE = MONOCHROME ? 'B3B3B3' : 'D6E0E7';
const CODE_BG = MONOCHROME ? 'F2F2F2' : 'F3F7F9';
const HEAD_BG = MONOCHROME ? 'E8E8E8' : 'EAF1F5';
const SANS = 'Calibri';
const SERIF = 'Times New Roman';
const MONO = 'Consolas';

/* ── small builders ───────────────────────────────────────────────────────── */
const t = (text, run = {}) => new TextRun({ text, ...run });
const br = () => new TextRun({ text: '', break: 1 });

/** Paragraph of body copy. `parts` is a string or an array of TextRuns. */
function p(parts, opts = {}) {
  const children = typeof parts === 'string' ? [t(parts)] : parts;
  return new Paragraph({
    children,
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 90, line: opts.line ?? 248 },
    indent: opts.indent,
    keepNext: opts.keepNext,
    ...opts.extra,
  });
}

function h1(text, num) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 170, after: 90 },
    keepNext: true,
    children: [
      new TextRun({ text: `${num}  ${text}`, bold: true, size: 30, color: INK, font: SANS }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: RULE, space: 6 } },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 60 },
    keepNext: true,
    children: [new TextRun({ text, bold: true, size: 23, color: ACCENT, font: SANS })],
  });
}

function bullets(items) {
  return items.map(
    (item) =>
      new Paragraph({
        children: typeof item === 'string' ? [t(item)] : item,
        bullet: { level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 45, line: 244 },
      }),
  );
}

/** Monospaced block: one paragraph, hard line breaks, light background. */
function code(lines, size = 17) {
  const children = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(br());
    children.push(new TextRun({ text: line === '' ? ' ' : line, font: MONO, size, color: INK }));
  });
  return new Paragraph({
    children,
    keepLines: true,
    keepNext: true,
    shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
      top: { style: BorderStyle.SINGLE, size: 2, color: CODE_BG, space: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: CODE_BG, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 2, color: CODE_BG, space: 6 },
    },
    spacing: { before: 60, after: 140, line: 236 },
    alignment: AlignmentType.LEFT,
  });
}

function cell(text, opts = {}) {
  const isHead = opts.head === true;
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: isHead ? { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 232 },
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text: String(text),
            bold: isHead,
            size: opts.size ?? 17,
            font: opts.mono ? MONO : SANS,
            color: isHead ? INK : opts.color ?? INK,
          }),
        ],
      }),
    ],
  });
}

function table({ head, rows, widths, mono = [], align = [] }) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        tableHeader: true,
        children: head.map((h, i) => cell(h, { head: true, width: widths?.[i], align: align[i] })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) =>
              cell(c, { width: widths?.[i], mono: mono.includes(i), align: align[i] }),
            ),
          }),
      ),
    ],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 50, after: 120 },
    children: [new TextRun({ text, size: 16, italics: true, color: MUTED, font: SANS })],
  });
}

async function figure(file, width, cap) {
  const data = await fs.readFile(path.join(FIG, file));
  const { width: w, height: h } = pngSize(data);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 0 },
      children: [
        new ImageRun({
          data,
          transformation: { width, height: Math.round((width * h) / w) },
          type: 'png',
        }),
      ],
    }),
    caption(cap),
  ];
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const spacer = (pts = 6) =>
  new Paragraph({ spacing: { before: 0, after: pts * 20 }, children: [] });

/* ── document ─────────────────────────────────────────────────────────────── */
const F = (name) => path.join(FIG, name);

async function build() {
  const children = [];

  /* ══ TITLE PAGE ══════════════════════════════════════════════════════════ */
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 20 },
      children: [new TextRun({ text: META.institution, bold: true, size: 26, color: INK, font: SANS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 420 },
      children: [new TextRun({ text: META.department, size: 20, color: MUTED, font: SANS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: META.course.toUpperCase(), size: 18, color: ACCENT, font: SANS, characterSpacing: 16 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
      children: [new TextRun({ text: META.unit, size: 19, color: MUTED, font: SANS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260, after: 40 },
      children: [new TextRun({ text: META.title, bold: true, size: 72, color: INK, font: SANS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 380 },
      indent: { left: 700, right: 700 },
      children: [new TextRun({ text: META.subtitle, size: 22, italics: true, color: MUTED, font: SERIF })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: 'Project report submitted for evaluation', size: 19, color: MUTED, font: SANS }),
      ],
    }),
  );

  const credentials = [];
  if (META.group) {
    credentials.push(new TableRow({ children: [cell('Group', { head: true, width: 30 }), cell(META.group, { width: 70 })] }));
  }
  for (const m of META.members) {
    credentials.push(
      new TableRow({
        children: [
          cell(m.name, { width: 30 }),
          cell(m.roll ? `Roll No. ${m.roll}` : '', { width: 70 }),
        ],
      }),
    );
  }
  if (META.guide) {
    credentials.push(
      new TableRow({ children: [cell('Submitted to', { head: true, width: 30 }), cell(META.guide, { width: 70 })] }),
    );
  }
  if (META.date) {
    credentials.push(
      new TableRow({ children: [cell('Date', { head: true, width: 30 }), cell(META.date, { width: 70 })] }),
    );
  }

  if (credentials.length > 1) {
    children.push(
      new Table({
        width: { size: 82, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: credentials,
      }),
    );
  } else if (META.date) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 0 },
        children: [new TextRun({ text: META.date, size: 20, color: INK, font: SANS })],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 460, after: 80 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 10 } },
      children: [
        new TextRun({ text: 'ABSTRACT', size: 17, bold: true, color: ACCENT, font: SANS, characterSpacing: 60 }),
      ],
    }),
    p(
      [
        t('MergeScope is a local, browser-based workbench that sorts log files — or any tabular '),
        t('data — with an instrumented merge sort and then explains the cost of the sort with a '),
        t('recursion tree. Every comparison, buffer copy and write is recorded, so the tool reports '),
        t('the exact comparison count, recursion depth and auxiliary memory instead of an opaque '),
        t('duration. The same run is replayed node by node on the recursion tree, which makes the '),
        t('recurrence T(n) = 2T(n/2) + Θ(n) visible as an animation rather than a formula, and a '),
        t('complexity lab measures the algorithm against quicksort and the native sort up to one '),
        t('million records on a log–log axis. On a 512-record incident log the implementation needs '),
        t('3,980 comparisons (7.77 per record), 4,608 moves and a recursion depth of 9, matching '),
        t('ceil(log₂ 512); on one million records it needs 18.7 million comparisons, 0.94·n·log₂n, in '),
        t('0.78 s. A stability panel proves the guarantee empirically: on the same data merge sort '),
        t('preserves the file order of all 19 equal-key pairs, while the Lomuto quicksort built as a '),
        t('control breaks 9 of them. The report covers the problem definition, the algorithm and its '),
        t('best / average / worst-case analysis, the implementation and interface, the test results '),
        t('and the group’s workload split.'),
      ],
      { after: 0, line: 250 },
    ),
  );

  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  /* ══ 1  INTRODUCTION ═════════════════════════════════════════════════════ */
  children.push(h1('Introduction & Problem Definition', '1'));

  children.push(
    p([
      t('A modern service writes more log lines in a minute than a person can read in a day. When '),
      t('something breaks at 03:00, the on-call engineer pulls the export — a flat file of timestamped '),
      t('events, stack traces and service names — and has to answer one question quickly: what happened '),
      t('first, and what happened because of it. Answering it means sorting, and usually sorting by more '),
      t('than one field: severity first, then time inside each severity. The ordering that comes out of '),
      t('that sort is the timeline the engineer reasons about, so two properties stop being academic. '),
      t('The sort must be '),
      t('stable', { bold: true }),
      t(' — equal severities must keep file order, otherwise two runs of the same command produce '),
      t('different timelines. And it must stay '),
      t('predictable', { bold: true }),
      t(' when the file grows from five hundred lines to five million, because the export that is slow '),
      t('is the export that is read during the incident.'),
    ]),
  );

  children.push(h2('1.1  The problem and its users'));
  children.push(
    p([
      t('The existing toolchain answers neither question well. A spreadsheet silently reorders ties and '),
      t('gives no cost model. The command-line '),
      t('sort', { font: MONO, size: 18 }),
      t(' is fast but opaque: it cannot say how many comparisons it made or how deep it recursed, and '),
      t('neither tool shows '),
      t('why', { italics: true }),
      t(' the cost grows the way it does. MergeScope was built for two audiences:'),
    ]),
  );
  children.push(
    ...bullets([
      [
        t('Students of Design and Analysis of Algorithms ', { bold: true }),
        t('who are asked to analyse a divide-and-conquer recurrence and want to see the tree they are summing over.'),
      ],
      [
        t('Engineers triaging an incident ', { bold: true }),
        t('who need a stable, explainable sort of a real export, with the cost printed next to the result.'),
      ],
    ]),
  );
  children.push(
    p(
      'The tool runs entirely in the browser — no server, no upload, no account — because the file being ' +
        'sorted is usually an incident export that should not leave the machine.',
      { before: 80 },
    ),
  );

  children.push(h2('1.2  Why merge sort is the right algorithm here'));
  children.push(
    p([
      t('Unit 1 assigns divide and conquer, and merge sort is the canonical case: its running time is '),
      t('described by the recurrence T(n) = 2T(n/2) + Θ(n), which is exactly the shape the '),
      t('recursion-tree method is designed to solve. Beyond the syllabus fit, it is also the correct '),
      t('engineering choice for this problem for three reasons.'),
    ]),
  );
  children.push(
    ...bullets([
      [
        t('Stable by construction. ', { bold: true }),
        t('The merge step takes from the left run when the two heads are equal (the '),
        t('≤', { font: MONO, size: 18 }),
        t(' rule), so records that tie keep their file order. Quicksort cannot promise this without '),
        t('carrying the original index as a tiebreaker.'),
      ],
      [
        t('Guaranteed Θ(n log n). ', { bold: true }),
        t('The split is positional — the middle of the range — so the tree is always balanced and no '),
        t('input can force the quadratic case that quicksort hits on already-sorted data. An incident '),
        t('export is very often already sorted by time, which is precisely the worst input for a naive pivot.'),
      ],
      [
        t('Predictable memory. ', { bold: true }),
        t('One auxiliary buffer of n elements, reused across the whole run: Θ(n) space, allocated once, '),
        t('not a new array per merge.'),
      ],
    ]),
  );

  /* ══ 2  ALGORITHM & THEORY ═══════════════════════════════════════════════ */
  children.push(h1('Algorithm & Theoretical Analysis', '2'));

  children.push(h2('2.1  The algorithm, step by step'));
  children.push(
    p(
      'Merge sort splits the range in half, sorts each half recursively, and merges the two sorted ' +
        'halves in linear time. The implementation in src/core/mergesort.ts sorts an index array rather ' +
        'than the records themselves, which keeps the payload small and makes “moves” a meaningful ' +
        'counter. The pseudocode below is the one the code follows, line for line.',
    ),
  );
  children.push(
    code([
      'mergeSort(A, lo, hi):                  // sorts the half-open range A[lo, hi)',
      '    if hi - lo <= 1: return            // 0 or 1 element: base case',
      '    mid <- (lo + hi) / 2               // integer division; split is positional',
      '    mergeSort(A, lo, mid)              // T(n/2)',
      '    mergeSort(A, mid, hi)              // T(n/2)',
      '    merge(A, lo, mid, hi)              // Theta(n)',
      '',
      'merge(A, lo, mid, hi):',
      '    i <- lo ; j <- mid ; k <- lo',
      '    while i < mid and j < hi:          // the only place comparisons happen',
      '        if A[i].key <= A[j].key:       // "<=" keeps the sort stable',
      '            tmp[k++] <- A[i++]',
      '        else:',
      '            tmp[k++] <- A[j++]',
      '    copy any remaining tail of either run into tmp',
      '    copy tmp[lo..hi) back into A[lo..hi)',
    ]),
  );

  children.push(...(await figure(MONOCHROME ? 'fig0-flowchart-bw.png' : 'fig0-flowchart.png', 470, 'Figure 1 — Control flow. The split costs no comparisons; the merge pass makes one comparison per element written, and the “≤” at the decision is the entire stability proof.')));
  children.push(
    p([
      t('The ranges are half-open, '),
      t('[lo, hi)', { font: MONO, size: 18 }),
      t(', so '),
      t('hi - lo', { font: MONO, size: 18 }),
      t(' is the size directly. The tie rule is '),
      t('≤', { font: MONO, size: 18 }),
      t(' and not '),
      t('<', { font: MONO, size: 18 }),
      t(': that one character is the whole stability proof, and §3.3 measures it.'),
    ]),
  );

  children.push(h2('2.2  The recursion tree'));
  children.push(
    p([
      t('Unrolling the recurrence draws a binary tree. The root is responsible for the merge of all n '),
      t('elements and therefore costs at most c·n. Its two children each merge n/2 elements, so together '),
      t('they cost c·n as well. That continues down the tree, which is the whole insight: '),
      t('every level costs the same', { bold: true }),
      t(', and the question becomes how many levels there are.'),
    ]),
  );
  children.push(
    table({
      head: ['Level', 'Nodes', 'Subproblem size', 'Cost of this level'],
      widths: [16, 16, 30, 38],
      mono: [0, 1],
      align: [AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.LEFT],
      rows: [
        ['0', '1', 'n', 'c·n'],
        ['1', '2', 'n/2 each', '2 · c·(n/2) = c·n'],
        ['2', '4', 'n/4 each', '4 · c·(n/4) = c·n'],
        ['k', '2ᵏ', 'n/2ᵏ each', '2ᵏ · c·(n/2ᵏ) = c·n'],
        ['log₂ n', 'n', '1 each', 'n · c·1 = c·n'],
      ],
    }),
  );
  children.push(
    p([
      t('The tree stops when a subproblem holds a single element, which happens after log₂ n splits. '),
      t('There are log₂ n + 1 levels, each contributing c·n, so'),
    ], { before: 120 }),
  );
  children.push(
    code(['T(n) = c·n · (log2 n + 1) = Theta(n log n)'], 19),
  );
  children.push(
    p([
      t('The same answer follows from the Master Theorem with a = 2, b = 2 and f(n) = Θ(n): since '),
      t('f(n) = Θ(n^(log_b a)) = Θ(n¹), this is case 2, and T(n) = Θ(n^log_b a · log n) = Θ(n log n). '),
      t('The two derivations agreeing is the point of doing both in Unit 1.'),
    ]),
  );

  children.push(h2('2.3  Best, average and worst case'));
  children.push(
    p(
      'Merge sort is unusual among the algorithms in this unit in that all three cases are the same ' +
        'order. The split is positional, not value-dependent, so no input can unbalance the tree, and ' +
        'the merge always touches every element of the range. What changes with the input is only the ' +
        'constant: already-sorted data makes the merge take from the left run every time and needs ' +
        'roughly half as many comparisons as a random permutation.',
    ),
  );
  children.push(
    table({
      head: ['Case', 'Time', 'Why'],
      widths: [18, 20, 62],
      rows: [
        ['Best', 'Θ(n log n)', 'The tree is built the same way for every input; best case only reduces the number of comparisons inside each merge.'],
        ['Average', 'Θ(n log n)', 'Expected comparisons ≈ n·log₂n − 1.26·n (Knuth, TAOCP 3, §5.2.4).'],
        ['Worst', 'Θ(n log n)', 'Every level of the recursion touches all n elements; there are ceil(log₂ n) levels.'],
        ['Auxiliary space', 'Θ(n)', 'One buffer of n elements, allocated once and reused by every merge.'],
        ['Recursion stack', 'Θ(log n)', 'Depth is ceil(log₂ n) — 20 frames for one million records.'],
        ['Total space', 'Θ(n)', 'The buffer dominates the stack.'],
        ['Stable', 'Yes', 'The merge takes from the left run when keys are equal.'],
        ['In place', 'No', 'The merge needs the auxiliary buffer; in-place merging exists but is slower by a constant.'],
      ],
    }),
  );

  /* ══ 3  IMPLEMENTATION ═══════════════════════════════════════════════════ */
  children.push(h1('Implementation & Interface', '3'));

  children.push(h2('3.1  Technology stack'));
  children.push(
    p(
      'The application is a static site with no backend: everything — parsing, sorting, analysis, ' +
        'export — happens on the client. The stack was chosen so that the project has no runtime ' +
        'dependency that could fail on a lab machine, and no build step that requires a network.',
    ),
  );
  children.push(
    table({
      head: ['Layer', 'Choice', 'Reason'],
      widths: [22, 26, 52],
      mono: [1],
      rows: [
        ['Language', 'TypeScript 5.7 (strict)', 'The worker protocol carries either a Float64Array or a string[]; strict types catch a mismatched key series at compile time.'],
        ['UI', 'React 19 + Vite 6', 'Component model for the five views, HMR while building. No UI kit, no CSS framework.'],
        ['Charts', 'Hand-written SVG', 'The log–log chart is ~150 lines. A charting library would have added ~90 kB to a project whose own code is ~300 kB.'],
        ['Sorting', 'Web Worker', 'A one-million-record sort must never block paint or input; the worker owns the run and posts progress.'],
        ['Tests', 'Vitest (49 tests)', 'Runs in Node, no browser needed; covers the sort, the parser and the stability counter.'],
        ['CLI', 'Node 24 type stripping', 'Reuses the same sorting module as the browser; no compilation step for the grader.'],
      ],
    }),
  );
  children.push(
    p(
      'Build output: 360 kB of JavaScript, 105 kB gzipped — of which 54 kB is the demo log bundled as a ' +
        'sample — plus 21 kB of CSS. No runtime dependency beyond React, and no network call at any ' +
        'point: the application works offline and can be served from a single folder.',
      { before: 120 },
    ),
  );

  children.push(h2('3.2  How the pieces fit'));
  children.push(
    p([
      t('The data path is deliberately narrow. The parser turns the file into records and, separately, '),
      t('into a '),
      t('key series', { bold: true }),
      t(' — a '),
      t('Float64Array', { font: MONO, size: 18 }),
      t(' for numeric keys such as timestamps or a CSV column, a '),
      t('string[]', { font: MONO, size: 18 }),
      t(' for text keys. Only the series crosses into the worker; the records stay on the main thread. '),
      t('The worker sorts indices, records every comparison and write, and posts back a result object: '),
      t('the permuted order, the metrics, the per-level aggregates and — if the input is small enough to '),
      t('draw — the recursion tree and the event stream for the replay.'),
    ]),
  );
  children.push(
    p([
      t('Capture is capped rather than unbounded: the tree is recorded up to 65,536 nodes (a one-million ' +
        'record sort would need two million), and the event stream up to 64 elements. Above those sizes ' +
        'the exact per-level '),
      t('aggregates', { italics: true }),
      t(' are still produced, so the cost table remains correct even when the drawing is summarised. '),
      t('The records table is virtualised — only the ~20 visible rows are mounted — which is why a '),
      t('one-million-row file scrolls smoothly.'),
    ]),
  );

  if (SHOTS) {
    children.push(...(await figure('fig1-workbench.png', 470, 'Figure 2 — The workbench after loading a 512-record incident log. Left: the parsed records, sorted by timestamp. Right: the measured cost — 3,980 comparisons, 4,608 moves, depth 9, Θ(n) auxiliary memory.')));
  }

  children.push(h2('3.3  The interface'));
  children.push(
    p([
      t('Five views share one state object: the '),
      t('Workbench', { bold: true }),
      t(' (source, keys, records, metrics, export), the '),
      t('Recursion tree', { bold: true }),
      t(' that replays the recorded events, the '),
      t('Complexity lab', { bold: true }),
      t(', the '),
      t('Theory', { bold: true }),
      t(' page, and the '),
      t('CLI & docs', { bold: true }),
      t(' page.'),
    ]),
  );

  if (SHOTS) {
    children.push(...(await figure('fig2-recursion-tree.png', 470, 'Figure 2 — The recursion tree at step 14 of 204: the active subproblem [2, 4) is highlighted, the two bars being compared are coloured, and the auxiliary buffer shows the four elements copied so far. The inspector prints the recurrence for that node, T(2) = T(1) + T(1) + Θ(2).')));
  }

  children.push(
    p([
      t('The tree view is where the recursion-tree method stops being a diagram on a slide. Each node ' +
        'carries its range, its size, its depth and the comparisons spent inside it; the table underneath ' +
        'aggregates the same data by level, and the second column shows that every level touches exactly ' +
        'n elements — the invariant the analysis relies on.'),
    ]),
  );

  if (SHOTS) {
    children.push(...(await figure('fig3-stability.png', 430, 'Figure 3 — The stability proof. The log is sorted by severity, then by timestamp. Merge sort reorders none of the 19 equal-key pairs; the Lomuto quicksort built as a control reorders 9 of them on identical input.')));
  }

  children.push(
    p([
      t('Stability is easy to claim and hard to see, so the panel computes it instead of asserting it: ' +
        'it finds every adjacent pair of records with equal sort keys, compares their position in the ' +
        'file with their position in the output, and counts violations. On the demo log merge sort scores ' +
        'zero and quicksort scores nine, which is the empirical form of the ' +
        '≤'),
      t(' argument in §2.1.'),
    ]),
  );

  children.push(h2('3.4  Edge cases and large data'));
  children.push(
    p(
      'The sample log was generated to be awkward on purpose, and each awkwardness is handled ' +
        'explicitly rather than by luck:',
    ),
  );
  children.push(
    table({
      head: ['Edge case', 'What the application does'],
      widths: [34, 66],
      rows: [
        ['Records with no timestamp', 'Kept, sorted last, and reported as a warning chip (2 of 512 in the demo file). Nothing is silently dropped.'],
        ['Multi-line stack traces', 'Continuation lines are attached to the preceding record instead of becoming garbage rows (9 records in the demo).'],
        ['Duplicate timestamps', 'Ties keep file order — the ≤ rule — so two runs produce the same timeline.'],
        ['CRLF line endings, BOM, mixed encodings', 'Normalised on read; undecodable bytes become replacement characters and parsing continues.'],
        ['CSV with quoted commas', 'A small RFC-4180 tokeniser, not a split(",").'],
        ['Empty or header-only file', 'Explicit empty state; the sort is skipped, nothing crashes.'],
        ['One million records', 'Sorted in a worker, rendered through a virtualised table, tree summarised. The tab stays interactive (18.7 M comparisons, 0.78 s).'],
        ['Re-sorting while a sort is running', 'The worker request carries a sequence number; stale results are discarded.'],
      ],
    }),
  );
  children.push(
    p(
      'Large datasets are also the reason the metrics are computed inside the algorithm rather than ' +
        'estimated afterwards: a counter incremented in the comparison loop costs nanoseconds and is ' +
        'exact, whereas timing on a browser is quantised to roughly 100 µs. Timings therefore use a ' +
        'best-of-k policy (25 runs below 500 elements, 5 runs below 5,000, one run above) and sizes whose ' +
        'total runtime falls under the timer resolution are omitted from the complexity lab’s timing plot ' +
        'rather than drawn as a fake flat line.',
      { before: 120 },
    ),
  );

  children.push(h2('3.5  Test results'));
  children.push(
    p(
      'Forty-nine automated tests cover the sort, the parser and the stability counter (npm test). The ' +
        'numbers below are the comparison counts the instrumented sort produced on random permutations; ' +
        'they are deterministic, which is why they are quoted instead of timings.',
    ),
  );
  children.push(
    table({
      head: ['n', 'Comparisons', '÷ n·log₂n', 'Depth', 'ceil(log₂ n)'],
      widths: [18, 26, 20, 18, 18],
      mono: [0, 1, 2, 3, 4],
      align: [AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT],
      rows: [
        ['100', '539', '0.81', '7', '7'],
        ['500', '3,844', '0.86', '9', '9'],
        ['2,000', '19,379', '0.88', '11', '11'],
        ['10,000', '120,453', '0.91', '14', '14'],
        ['50,000', '718,044', '0.92', '16', '16'],
        ['200,000', '3,272,400', '0.93', '18', '18'],
        ['1,000,000', '18,675,115', '0.94', '20', '20'],
      ],
    }),
  );
  children.push(
    p(
      'The measured depth equals the ceiling of log₂ n in every row — the tree is balanced, as the positional split ' +
        'promises — and the ratio rises monotonically towards 1, below n·log₂n as Knuth’s bound ' +
        'requires.',
      { before: 120 },
    ),
  );

  if (INCLUDE_CHARTS) {
    children.push(...(await figure('fig4-complexity.png', 450, 'Figure 5 — The complexity lab. On log–log axes a Θ(n log n) algorithm is a straight line with a small slope; the measured merge sort sits fractionally under the fitted n·log₂n line.')));
  }

  children.push(
    p(
      'On the demo file — 512 records, 52 kB, two records without timestamps, nine multi-line stack ' +
        'traces and ten groups of duplicate timestamps — the run reports 3,980 comparisons (7.77 per ' +
        'record), 4,608 moves, 1,023 recursive calls (exactly 2n − 1, as the tree shape predicts) and a ' +
        'depth of 9. Sorting by severity and then timestamp costs 3,969 comparisons and yields zero ' +
        'stability violations, against nine for the quicksort control.',
    ),
  );

  /* ══ 4  CONCLUSION ═══════════════════════════════════════════════════════ */
  children.push(h1('Conclusion & Contributions', '4'));

  children.push(h2('4.1  Workload distribution'));
  children.push(
      p('Work was split along module boundaries so that each area could be owned and reviewed separately.'),
  );
  children.push(
    table({
      head: ['Area', 'Modules owned', 'Share'],
      widths: [24, 62, 14],
      align: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.RIGHT],
      rows: [
        ['Algorithm core', 'src/core/mergesort.ts, quicksort.ts, playback.ts, stability.ts; the 49 automated tests', '30%'],
        ['Interface', 'src/components/* — workbench, recursion-tree replay, hand-written SVG charts, styles', '30%'],
        ['Input & CLI', 'src/parse/* — log and CSV parsers, key extraction; cli/index.ts; the sample datasets', '20%'],
        ['Testing & docs', 'Test runs and benchmarks, documentation (README, THEORY, ASSUMPTIONS), this report', '20%'],
      ],
    }),
  );

  children.push(h2('4.2  What we learned and what was hard'));
  children.push(
    ...bullets([
      [
        t('The analysis is the design tool, not the paperwork. ', { bold: true }),
        t('Recording per-node comparisons was originally a debugging aid; it became the feature that ' +
          'proves the tree is balanced on real data.'),
      ],
      [
        t('Constants are invisible until you measure them. ', { bold: true }),
        t('Merge sort makes more comparisons than quicksort on random input, yet loses on wall-clock time ' +
          'to a hybrid — Big-Θ explains the shape, not the ranking.'),
      ],
      [
        t('Stability is a property of one character. ', { bold: true }),
        t('Writing '),
        t('<', { font: MONO, size: 18 }),
        t(' instead of '),
        t('≤', { font: MONO, size: 18 }),
        t(' in the merge makes the sort unstable, and the failure is invisible on data without ties. ' +
          'The panel exists because the bug would otherwise ship.'),
      ],
      [
        t('Browser timers cannot be trusted below ~100 µs. ', { bold: true }),
        t('The first benchmark run produced a flat line of identical “0 µs” results; the fix was best-of-k ' +
          'timing plus refusing to plot points that the clock cannot resolve.'),
      ],
      [
        t('The worker boundary has to be typed. ', { bold: true }),
        t('A union of key-series types crossing postMessage needed a distributive Omit before strict ' +
          'TypeScript accepted it.'),
      ],
    ]),
  );

  children.push(h2('4.3  Future enhancements'));
  children.push(
    ...bullets([
      [
        t('External merge sort. ', { bold: true }),
        t('The one capability the current version deliberately leaves out: sorted runs written to disk ' +
          'and k-way merged, for exports larger than memory. The in-memory algorithm and the recursion ' +
          'tree are unchanged by it.'),
      ],
      [
        t('Recorded traces. ', { bold: true }),
        t('Exporting the event stream as JSON would let a grader replay a run offline and check that the ' +
          'tree view is faithful rather than illustrative.'),
      ],
      [
        t('Natural merge sort (TimSort-style runs), ', { bold: true }),
        t('which exploits the fact that log files arrive nearly sorted and would make the already-sorted ' +
          'case linear.'),
      ],
    ]),
  );

  children.push(h2('4.4  Conclusion'));
  children.push(
    p([
      t('MergeScope sorts real log files, but its purpose is narrower than a log viewer: it makes the '),
      t('cost of a divide-and-conquer algorithm observable. The recursion tree that Unit 1 draws on '),
      t('paper is the same tree the application renders, the comparison count that the analysis bounds '),
      t('is the number printed on screen, and the stability property that the '),
      t('≤', { font: MONO, size: 18 }),
      t(' in the merge guarantees is measured on every run and compared against a control that fails it. '),
      t('The measured depth matched ceil(log₂ n) in all seven benchmark sizes and the comparison ratio stayed '),
      t('between 0.81 and 0.94 of n·log₂n, which is the theory holding on real data rather than a table '),
      t('copied from a textbook.'),
    ]),
  );

  /* ── references ─────────────────────────────────────────────────────────── */
  children.push(h1('References', ''));
  const refs = [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., Stein, C. Introduction to Algorithms, 4th ed. MIT Press, 2022 — §2.3 (divide and conquer), §4.3–4.5 (recursion tree, Master Theorem), §7 (quicksort).',
    'Knuth, D. E. The Art of Computer Programming, Vol. 3: Sorting and Searching, 2nd ed. Addison-Wesley, 1998 — §5.2.4, “Sorting by Merging”, for the comparison bounds used in §2.3.',
    'Sedgewick, R., Wayne, K. Algorithms, 4th ed. Addison-Wesley, 2011 — §2.2, mergesort and stability.',
    'MDN Web Docs. “Web Workers API” and “Performance.now(): reduced time precision”. Mozilla, 2024.',
    'React 19 documentation (react.dev) and Vite 6 documentation (vite.dev) — component model and build setup.',
    'Project repository: README.md (results table), THEORY.md (full derivation), ASSUMPTIONS.md (design decisions), VIVA.md (defence notes).',
  ];
  refs.forEach((r, i) => {
    children.push(
      new Paragraph({
        spacing: { after: 80, line: 246 },
        indent: { left: 360, hanging: 360 },
        alignment: AlignmentType.JUSTIFIED,
        children: [t(`[${i + 1}]  `), t(r)],
      }),
    );
  });

  /* ── appendix ───────────────────────────────────────────────────────────── */
  children.push(h1('Appendix A — Running the project', ''));
  children.push(
    p('Requirements: Node.js 20 or newer and a browser. No network access is needed after npm install.'),
  );
  children.push(
    code([
      'npm install',
      'npm run dev        # workbench at http://localhost:5173',
      'npm test           # 49 automated tests',
      'npm run build      # static bundle in dist/',
      '',
      'node cli/index.ts sample-data/incident-2024-05-01.log --key time --limit 5',
      'node cli/index.ts sample-data/incident-2024-05-01.log --key severity --then time --json',
      'node cli/index.ts export.csv --key col:duration_ms --order desc',
    ]),
  );
  children.push(
    p(
      'The CLI prints the same metrics as the interface and accepts --key, --then, --order, --limit, ' +
        '--out and --json. Log keys: time, severity, source, message, line. CSV keys: col:<header>.',
      { before: 120 },
    ),
  );

  /* ── document assembly ──────────────────────────────────────────────────── */
  const doc = new Document({
    creator: 'MergeScope',
    title: `${META.title} — DAA Unit 1 project report`,
    description: META.subtitle,
    styles: {
      default: {
        document: {
          run: { font: SERIF, size: 22, color: INK },
          paragraph: { spacing: { line: 248, after: 90 } },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            margin: { top: 1020, bottom: 1020, left: 1134, right: 1134 },
          },
        },
        headers: {
          first: new Header({ children: [new Paragraph({ children: [] })] }),
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
                tabStops: [{ type: 'right', position: 9026 }],
                children: [
                  new TextRun({ text: 'MergeScope', bold: true, size: 15, color: ACCENT, font: SANS }),
                  new TextRun({ text: '\tDAA Unit 1 · Merge Sort & the Recursion Tree', size: 15, color: MUTED, font: SANS }),
                ],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: 'right', position: 9026 }],
                children: [
                  new TextRun({ text: join(META.group, META.date), size: 15, color: MUTED, font: SANS }),
                  new TextRun({ text: '\tPage ', size: 15, color: MUTED, font: SANS }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED, font: SANS }),
                  new TextRun({ text: ' of ', size: 15, color: MUTED, font: SANS }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED, font: SANS }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const out = path.join(HERE, OUT_FILE);
  await fs.writeFile(out, buffer);
  const pages = Math.round(buffer.length / 1024);
  console.log(`wrote ${out} — ${pages} KB`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
