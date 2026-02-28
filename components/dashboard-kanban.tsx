'use client';

import { useEffect, useMemo, useState } from 'react';

type WorkflowStatus = 'open' | 'planned' | 'in_progress' | 'shipped';

type FeedbackItem = {
  id: string;
  title: string;
  preview?: string;
  status: WorkflowStatus | null;
  source?: string;
  reference?: string;
  upvotes: number;
  created_at: string;
  attachments?: string[];
};

type DashboardKanbanProps = {
  isAdmin: boolean;
};

type Lane = {
  key: WorkflowStatus;
  label: string;
};

const LANES: Lane[] = [
  { key: 'open', label: 'NEW' },
  { key: 'planned', label: 'PLANNED' },
  { key: 'in_progress', label: 'IN PROGRESS' },
  { key: 'shipped', label: 'SHIPPED' },
];

function normalizeStatus(value: string | null | undefined): WorkflowStatus {
  if (value === 'planned') return 'planned';
  if (value === 'in_progress') return 'in_progress';
  if (value === 'shipped') return 'shipped';
  return 'open';
}

export function DashboardKanban({ isAdmin }: DashboardKanbanProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<Record<string, boolean>>({});
  const [sourceFilter, setSourceFilter] = useState('all');

  async function loadItems() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/feedback?sort=new', { cache: 'no-store' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to load feedback stream');
      }
      const data = (await response.json()) as { items: FeedbackItem[] };
      setItems((data.items || []).map((item) => ({ ...item, status: normalizeStatus(item.status) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback stream');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    function onChanged() {
      loadItems();
    }

    window.addEventListener('feedback:created', onChanged);
    window.addEventListener('feedback:status-updated', onChanged);
    return () => {
      window.removeEventListener('feedback:created', onChanged);
      window.removeEventListener('feedback:status-updated', onChanged);
    };
  }, []);

  const grouped = useMemo(() => {
    const filtered = sourceFilter === 'all' ? items : items.filter((item) => (item.source || 'web') === sourceFilter);
    return LANES.map((lane) => ({
      ...lane,
      items: filtered.filter((item) => normalizeStatus(item.status) === lane.key),
    }));
  }, [items, sourceFilter]);

  async function moveItem(id: string, status: WorkflowStatus) {
    setMoving((state) => ({ ...state, [id]: true }));
    setError('');
    try {
      const response = await fetch(`/api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to update status');
      }

      setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
      window.dispatchEvent(new CustomEvent('feedback:status-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setMoving((state) => ({ ...state, [id]: false }));
    }
  }

  return (
    <section className='pf-card dashboard-card'>
      <div className='dashboard-head'>
        <div>
          <h2 className='section-title dashboard-title'>KANBAN CONTROL</h2>
          <p className='hero-meta'>Workflow stream for roadmap delivery.</p>
        </div>
        {isAdmin ? (
          <div className='dashboard-filters'>
            <label className='pf-label'>SOURCE_FILTER</label>
            <select className='pf-input' value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value='all'>ALL</option>
              <option value='web'>WEB_WIDGET</option>
              <option value='email'>EMAIL</option>
              <option value='discord'>DISCORD</option>
              <option value='x_twitter'>X_TWITTER</option>
              <option value='slack'>SLACK</option>
              <option value='other'>OTHER</option>
            </select>
          </div>
        ) : null}
        <button type='button' className='pf-button dashboard-refresh' onClick={loadItems} disabled={loading}>
          <span>{loading ? 'SYNCING...' : 'REFRESH'}</span>
          <span>↻</span>
        </button>
      </div>

      {!isAdmin ? <p className='admin-lock dashboard-lock'>READ ONLY: admin email required for status changes.</p> : null}
      {error ? <p className='pf-error'>{error}</p> : null}

      <div className='dashboard-grid'>
        {grouped.map((lane) => (
          <section key={lane.key} className='dashboard-lane'>
            <header className='dashboard-lane-head'>
              <h3>{lane.label}</h3>
              <span>{lane.items.length}</span>
            </header>

            <div className='dashboard-items'>
              {lane.items.map((item) => (
                <article key={item.id} className='dashboard-item'>
                  <h4>{item.title}</h4>
                  <p>{item.preview || 'No preview available.'}</p>
                  <div className='dashboard-item-meta'>
                    <span>▲ {item.upvotes}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <span>{item.attachments?.length || 0} img</span>
                    {isAdmin ? <span>{(item.source || 'web').toUpperCase()}</span> : null}
                    {isAdmin && item.reference ? (
                      <a href={item.reference} target='_blank' rel='noreferrer' className='dashboard-ref-link'>
                        ref↗
                      </a>
                    ) : null}
                  </div>
                  <select
                    className='pf-input'
                    value={normalizeStatus(item.status)}
                    disabled={!isAdmin || Boolean(moving[item.id])}
                    onChange={(event) => moveItem(item.id, event.target.value as WorkflowStatus)}>
                    {LANES.map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
              {lane.items.length === 0 ? <p className='board-note'>No items.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
