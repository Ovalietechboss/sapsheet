import { useEffect, useState } from 'react';
import { loadDataset } from './data/queries';
import { indexDataset, type Indexed } from './data/metrics';
import Dashboard from './components/Dashboard';
import Explorer from './components/Explorer';

type Tab = 'dashboard' | 'explorer';
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; ds: Indexed };

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadDataset()
      .then((ds) => active && setState({ status: 'ready', ds: indexDataset(ds) }))
      .catch((e) => active && setState({ status: 'error', message: String(e.message || e) }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>Domms Analytics</h1>
          <div className="sub">Tableaux de bord &amp; reporting — remplacement DigDash</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          Tableau de bord
        </button>
        <button className={`tab ${tab === 'explorer' ? 'active' : ''}`} onClick={() => setTab('explorer')}>
          Exploration ad-hoc
        </button>
      </div>

      {state.status === 'loading' && <div className="state">Chargement des données Domms…</div>}
      {state.status === 'error' && (
        <div className="state error">
          <strong>Impossible de charger les données.</strong>
          <div style={{ marginTop: 8 }}>{state.message}</div>
        </div>
      )}
      {state.status === 'ready' &&
        (tab === 'dashboard' ? <Dashboard ds={state.ds} /> : <Explorer ds={state.ds} />)}
    </div>
  );
}
