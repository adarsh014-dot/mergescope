/**
 * Stability proof panel.
 *
 * Compares the hand-written merge sort against a Lomuto quicksort on the same
 * data and the same comparator: if equal keys exist, quicksort will reorder them
 * and merge sort will not. The numbers are measured, not asserted.
 *
 * @module components/StabilityPanel
 */

import { useApp } from '../state/AppState.tsx';
import { formatInt } from '../lib/format.ts';

export function StabilityPanel() {
  const { stability, quickStability, stabilityNote, result, setKeyId, setSecondaryKeyId, data } =
    useApp();

  if (!result || !stability) return null;

  const mergeOk = stability.violations === 0;
  const quickBroken = quickStability ? quickStability.violations : null;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">
          <span className="idx">05</span> Stability
        </h2>
        <span className="spacer" />
        <span className={mergeOk ? 'chip accent' : 'chip'}>{mergeOk ? 'stable ✓' : 'unstable ✗'}</span>
      </header>
      <div className="panel-body">
        <div className="kv">
          <span>Equal-key pairs</span>
          <b>{formatInt(stability.tiePairs)}</b>
        </div>
        <div className="kv">
          <span>Merge sort reorders</span>
          <b style={{ color: mergeOk ? 'var(--ok)' : 'var(--err)' }}>{stability.violations}</b>
        </div>
        <div className="kv">
          <span>Quicksort reorders</span>
          <b style={{ color: quickBroken ? 'var(--err)' : 'var(--muted)' }}>
            {quickBroken === null ? 'n too big' : formatInt(quickBroken)}
          </b>
        </div>

        <p className="xs muted" style={{ marginTop: 10 }}>
          {stabilityNote}
        </p>

        {quickBroken !== null && quickBroken > 0 && (
          <div className="callout warn" style={{ marginTop: 10 }}>
            <b>Same data, different guarantee.</b> Lomuto quicksort swapped {formatInt(quickBroken)}{' '}
            equal-key pair(s) out of file order. Merge sort swapped none — that is the whole reason
            it is the safe choice for “sort by severity, then by time”.
          </div>
        )}

        {data?.kind === 'log' && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginTop: 10, paddingLeft: 0 }}
            onClick={() => {
              setKeyId('severity');
              setSecondaryKeyId('time');
            }}
          >
            → Sort by severity, then timestamp
          </button>
        )}
      </div>
    </section>
  );
}
