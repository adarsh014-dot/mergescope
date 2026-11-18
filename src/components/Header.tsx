/**
 * Application header: brand, view navigation, dataset chip, theme switch.
 *
 * @module components/Header
 */

import { useApp } from '../state/AppState.tsx';
import type { View } from '../state/AppState.tsx';
import { formatInt } from '../lib/format.ts';

const NAV: { id: View; label: string }[] = [
  { id: 'workbench', label: 'Workbench' },
  { id: 'tree', label: 'Recursion tree' },
  { id: 'complexity', label: 'Complexity lab' },
  { id: 'theory', label: 'Theory' },
  { id: 'cli', label: 'CLI & docs' },
];

export function Header() {
  const { view, setView, theme, toggleTheme, data, fileName } = useApp();

  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => setView('workbench')}
          aria-label="MergeScope home"
        >
          <span className="brand-mark" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 3v6m0 0-5 5m5-5 5 5M5 21h14" />
            </svg>
          </span>
          MergeScope
          <small>merge sort · recursion tree</small>
        </button>

        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-btn"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.id === 'tree' && <span className="dot" aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          {data && (
            <span className="chip accent" title={fileName}>
              {fileName} · {formatInt(data.records.length)} rec
            </span>
          )}
          <button
            type="button"
            className="btn btn-icon btn-ghost"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
