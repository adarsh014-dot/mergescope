/**
 * Global application store.
 *
 * Deliberately small: one context, one set of derived values, no external state
 * library. Sorting runs in a worker, so the store only tracks "what has been
 * measured", never partial results.
 *
 * @module state/AppState
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { buildKeySeries, defaultKey, keyOptions, parseFile } from '../parse/index.ts';
import type { KeyOption } from '../parse/index.ts';
import type { LogRecord, ParsedData } from '../parse/types.ts';
import { buildComparator } from '../core/keys.ts';
import type { KeyId } from '../parse/index.ts';
import type { SortKeySpec, SortOrder } from '../core/keys.ts';
import type { SortResult } from '../core/types.ts';
import { checkStability, describeStability } from '../core/stability.ts';
import type { StabilityReport } from '../core/stability.ts';
import { quickSortIndices } from '../core/quicksort.ts';
import { sortInWorker } from '../workers/client.ts';
import { SAMPLE_DATASETS } from '../data/samples.ts';

export type View = 'workbench' | 'tree' | 'complexity' | 'theory' | 'cli';
export type Theme = 'dark' | 'light';

export interface AppStore {
  view: View;
  setView: (view: View) => void;

  theme: Theme;
  toggleTheme: () => void;

  data: ParsedData | null;
  fileName: string;
  loading: boolean;
  loadError: string | null;

  keyId: KeyId;
  setKeyId: (id: KeyId) => void;
  secondaryKeyId: KeyId | 'none';
  setSecondaryKeyId: (id: KeyId | 'none') => void;
  order: SortOrder;
  setOrder: (order: SortOrder) => void;
  keyChoices: KeyOption[];

  spec: SortKeySpec | null;
  result: SortResult | null;
  sorting: boolean;
  sortError: string | null;
  runToken: number;
  runSort: () => void;

  records: LogRecord[];
  sortedRecords: LogRecord[];
  stability: StabilityReport | null;
  stabilityNote: string;
  quickStability: StabilityReport | null;

  loadText: (name: string, text: string) => void;
  loadFile: (file: File) => Promise<void>;
  loadSample: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<AppStore | null>(null);

/** Cap on inputs that get a live quicksort comparison for the stability panel. */
const QUICK_COMPARE_LIMIT = 20_000;

function readInitialTheme(): Theme {
  const stored = localStorage.getItem('mergescope.theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('workbench');
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [data, setData] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyId, setKeyId] = useState<KeyId>('time');
  const [secondaryKeyId, setSecondaryKeyId] = useState<KeyId | 'none'>('none');
  const [order, setOrder] = useState<SortOrder>('asc');

  const [spec, setSpec] = useState<SortKeySpec | null>(null);
  const [result, setResult] = useState<SortResult | null>(null);
  const [sorting, setSorting] = useState(false);
  const [sortError, setSortError] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(0);

  const epoch = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mergescope.theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const applyData = useCallback((name: string, text: string) => {
    try {
      const parsed = parseFile(name, text);
      if (parsed.records.length === 0) {
        setLoadError(
          'No records found. The file parsed to 0 rows — check that it is a log or CSV file.',
        );
        return;
      }
      setData(parsed);
      setFileName(name);
      setLoadError(null);
      setKeyId(defaultKey(parsed));
      setSecondaryKeyId('none');
      setResult(null);
      setSortError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const loadText = useCallback(
    (name: string, text: string) => {
      setLoading(true);
      // Let the browser paint the "loading" state before parsing big files.
      setTimeout(() => {
        applyData(name, text);
        setLoading(false);
      }, 0);
    },
    [applyData],
  );

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setLoadError(null);
      try {
        const text = await file.text();
        applyData(file.name, text);
      } catch (error) {
        setLoadError(`Could not read "${file.name}": ${String(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [applyData],
  );

  const loadSample = useCallback(
    (id: string) => {
      const sample = SAMPLE_DATASETS.find((s) => s.id === id);
      if (sample) loadText(sample.fileName, sample.make());
    },
    [loadText],
  );

  const clear = useCallback(() => {
    epoch.current++;
    setData(null);
    setFileName('');
    setResult(null);
    setSpec(null);
    setSortError(null);
    setLoadError(null);
    setSorting(false);
  }, []);

  const runSort = useCallback(async () => {
    if (!data) return;
    const n = data.records.length;
    const runId = ++epoch.current;
    setSorting(true);
    setSortError(null);

    try {
      const primary = buildKeySeries(data, keyId);
      const secondary =
        secondaryKeyId !== 'none' ? buildKeySeries(data, secondaryKeyId) : undefined;
      const nextSpec: SortKeySpec = {
        primary,
        primaryOrder: order,
        secondary,
        secondaryOrder: 'asc',
      };

      // Big files: sort on the main thread only for tiny inputs, otherwise the worker.
      const started = performance.now();
      const next = await sortInWorker(n, nextSpec, { recordTree: true, recordEvents: true });
      if (runId !== epoch.current) return;

      // `elapsedMs` measures the sort loop only; add the round-trip cost so the
      // UI never claims a time faster than what the user actually waited.
      next.metrics.elapsedMs = Math.max(next.metrics.elapsedMs, performance.now() - started);

      setResult(next);
      setSpec(nextSpec);
      setSorting(false);
    } catch (error) {
      if (runId !== epoch.current) return;
      setSortError(error instanceof Error ? error.message : String(error));
      setSorting(false);
    }
  }, [data, keyId, secondaryKeyId, order]);

  // Any change to the dataset or the key configuration re-runs the sort.
  useEffect(() => {
    if (!data) return;
    void runSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, keyId, secondaryKeyId, order, runToken]);

  const keyChoices = useMemo<KeyOption[]>(() => (data ? keyOptions(data) : []), [data]);

  const records = useMemo<LogRecord[]>(() => data?.records ?? [], [data]);

  const sortedRecords = useMemo<LogRecord[]>(() => {
    if (!data) return [];
    if (!result) return data.records;
    const out: LogRecord[] = new Array(result.order.length);
    for (let i = 0; i < result.order.length; i++) out[i] = data.records[result.order[i]];
    return out;
  }, [data, result]);

  const stability = useMemo<StabilityReport | null>(() => {
    if (!result || !spec) return null;
    return checkStability(spec, result.order, result.order.length);
  }, [result, spec]);

  const quickStability = useMemo<StabilityReport | null>(() => {
    if (!spec || !data) return null;
    const n = data.records.length;
    if (n <= 1 || n > QUICK_COMPARE_LIMIT) return null;
    const quick = quickSortIndices(n, buildComparator(spec));
    return checkStability(spec, quick.order, n);
  }, [spec, data]);

  const stabilityNote = stability ? describeStability(stability) : '';

  const value: AppStore = {
    view,
    setView,
    theme,
    toggleTheme,
    data,
    fileName,
    loading,
    loadError,
    keyId,
    setKeyId,
    secondaryKeyId,
    setSecondaryKeyId,
    order,
    setOrder,
    keyChoices,
    spec,
    result,
    sorting,
    sortError,
    runToken,
    runSort: () => setRunToken((t) => t + 1),
    records,
    sortedRecords,
    stability,
    stabilityNote,
    quickStability,
    loadText,
    loadFile,
    loadSample,
    clear,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the app store. Throws if used outside the provider. */
export function useApp(): AppStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
