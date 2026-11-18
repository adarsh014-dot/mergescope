/**
 * Application shell and view routing (state-based, no router dependency).
 *
 * @module App
 */

import { Header } from './components/Header.tsx';
import { useApp } from './state/AppState.tsx';
import { WorkbenchView } from './views/WorkbenchView.tsx';
import { TreeView } from './views/TreeView.tsx';
import { ComplexityView } from './views/ComplexityView.tsx';
import { TheoryView } from './views/TheoryView.tsx';
import { CliView } from './views/CliView.tsx';

export function App() {
  const { view } = useApp();

  return (
    <div className="app">
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main className="main" id="main">
        <div className="shell">
          {view === 'workbench' && <WorkbenchView />}
          {view === 'tree' && <TreeView />}
          {view === 'complexity' && <ComplexityView />}
          {view === 'theory' && <TheoryView />}
          {view === 'cli' && <CliView />}
        </div>
      </main>
      <footer className="footer">
        <div className="shell footer-inner">
          <span>
            <strong style={{ color: 'var(--text-2)' }}>MergeScope</strong> — merge sort &amp; the
            recursion tree, measured rather than claimed.
          </span>
          <span>100% client-side · no uploads · no tracking</span>
          <span className="mono">Θ(n log n)</span>
        </div>
      </footer>
    </div>
  );
}
