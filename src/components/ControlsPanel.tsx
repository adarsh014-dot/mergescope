/**
 * Sort configuration: primary key, secondary key, direction, re-run.
 *
 * @module components/ControlsPanel
 */

import { useApp } from '../state/AppState.tsx';
import { Panel, Segmented } from './ui.tsx';
import { formatInt } from '../lib/format.ts';
import type { KeyId } from '../parse/index.ts';

export function ControlsPanel() {
  const {
    data,
    keyChoices,
    keyId,
    setKeyId,
    secondaryKeyId,
    setSecondaryKeyId,
    order,
    setOrder,
    sorting,
    runSort,
    result,
  } = useApp();

  if (!data) return null;

  return (
    <Panel
      index="02"
      title="Sort keys"
      tools={
        <span className="chip">
          n = {formatInt(data.records.length)}
        </span>
      }
    >
      <div className="controls-grid">
        <div className="field">
          <label className="label" htmlFor="key-primary">
            Primary key
          </label>
          <select
            id="key-primary"
            className="select"
            value={keyId}
            onChange={(event) => setKeyId(event.target.value as KeyId)}
          >
            {keyChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label} · {choice.hint}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="key-secondary">
            Then by <span className="dim">(optional)</span>
          </label>
          <select
            id="key-secondary"
            className="select"
            value={secondaryKeyId}
            onChange={(event) => setSecondaryKeyId(event.target.value as KeyId | 'none')}
          >
            <option value="none">— none —</option>
            {keyChoices
              .filter((choice) => choice.id !== keyId)
              .map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
          </select>
        </div>

        <div className="field">
          <span className="label" id="order-label">
            Direction
          </span>
          <Segmented
            value={order}
            ariaLabel="Sort direction"
            options={[
              { value: 'asc', label: 'Ascending' },
              { value: 'desc', label: 'Descending' },
            ]}
            onChange={setOrder}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={runSort}
          disabled={sorting}
          style={{ height: 38 }}
        >
          {sorting ? 'Sorting…' : result ? 'Sort again' : 'Sort'}
        </button>
      </div>

      <p className="xs muted" style={{ marginTop: 12 }}>
        Changing any control re-runs the merge sort immediately. Ties keep their file order — that is
        what makes the second key safe.
      </p>
    </Panel>
  );
}
