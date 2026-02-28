'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type SortMode = 'new' | 'popular' | 'trending';

type FeedbackItem = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  preview?: string;
  type?: string;
  priority?: string;
  status: string | null;
  upvotes: number;
  attachments?: string[];
};

type FeedbackBoardProps = {
  embedded?: boolean;
  isAdmin?: boolean;
};

const SORTS: SortMode[] = ['new', 'popular', 'trending'];
const STATUSES = [
  { value: 'open', label: 'NEW' },
  { value: 'planned', label: 'PLANNED' },
  { value: 'in_progress', label: 'IN_PROGRESS' },
  { value: 'shipped', label: 'SHIPPED' },
] as const;

export function FeedbackBoard({ embedded = false, isAdmin = false }: FeedbackBoardProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [sort, setSort] = useState<SortMode>('new');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [voted, setVoted] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<FeedbackItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [mounted, setMounted] = useState(false);

  async function loadFeedback(currentSort: SortMode, onSuccess?: (items: FeedbackItem[]) => void) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/feedback?sort=${currentSort}`, { cache: 'no-store' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to load feedback');
      }
      const data = (await response.json()) as { items: FeedbackItem[] };
      onSuccess?.(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMounted(true);
    setVoted(JSON.parse(localStorage.getItem('pf_voted_feedback') || '[]') as string[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadFeedback(sort, (nextItems) => {
      if (!cancelled) setItems(nextItems);
    });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  useEffect(() => {
    function onCreated() {
      loadFeedback(sort, (nextItems) => setItems(nextItems));
    }

    window.addEventListener('feedback:created', onCreated);
    return () => {
      window.removeEventListener('feedback:created', onCreated);
    };
  }, [sort]);

  const votedIds = useMemo(() => new Set(voted), [voted]);

  async function upvote(id: string) {
    if (votedIds.has(id)) return;
    setVoting((state) => ({ ...state, [id]: true }));
    try {
      const response = await fetch(`/api/feedback/${id}/upvote`, { method: 'POST' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Vote failed');
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, upvotes: item.upvotes + 1 } : item))
      );
      const next = [...voted, id];
      localStorage.setItem('pf_voted_feedback', JSON.stringify(next));
      setVoted(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting((state) => ({ ...state, [id]: false }));
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingStatus(true);
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

      setItems((current) => current.map((item) => (item.id === id ? { ...item, status: status as FeedbackItem['status'] } : item)));
      setActiveItem((current) => (current && current.id === id ? { ...current, status: status as FeedbackItem['status'] } : current));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedback:status-updated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  const wrapperClass = embedded ? 'board-card embedded' : 'pf-card board-card';

  return (
    <section className={wrapperClass}>
      <div className='board-header'>
        <h3>MISSION BOARD</h3>
        <div className='sort-tabs'>
          {SORTS.map((value) => (
            <button
              key={value}
              type='button'
              className={`sort-tab ${sort === value ? 'active' : ''}`}
              onClick={() => setSort(value)}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className='board-note'>Loading feedback stream...</p> : null}
      {error ? <p className='pf-error'>{error}</p> : null}

      <div className='board-list'>
        {items.map((item) => (
          <article key={item.id} className='board-item'>
            <div className='board-item-head'>
              <button type='button' className='board-open' onClick={() => setActiveItem(item)}>
                <h4>{item.title}</h4>
              </button>
              <button
                type='button'
                className='vote-button'
                disabled={Boolean(voting[item.id]) || votedIds.has(item.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  upvote(item.id);
                }}>
                ▲ {item.upvotes}
              </button>
            </div>
            <p>{item.preview || item.description}</p>
            {item.attachments && item.attachments.length > 0 ? (
              <p className='board-attachments'>Attachments: {item.attachments.length}</p>
            ) : null}
          </article>
        ))}
        {!loading && items.length === 0 ? <p className='board-note'>No missions logged yet.</p> : null}
      </div>

      {mounted && activeItem
        ? createPortal(
            <div className='board-modal-backdrop' onClick={() => setActiveItem(null)}>
              <div className='board-modal' onClick={(event) => event.stopPropagation()}>
                <div className='board-modal-head'>
                  <h4>{activeItem.title}</h4>
                  <button type='button' className='modal-close' onClick={() => setActiveItem(null)}>
                    CLOSE
                  </button>
                </div>

                <p className='board-modal-meta'>
                  {new Date(activeItem.created_at).toLocaleString()} · {activeItem.type || 'FEATURE_REQUEST'} ·{' '}
                  {activeItem.priority || 'MEDIUM'} · {activeItem.status === 'open' ? 'NEW' : activeItem.status?.toUpperCase()}
                </p>

                <div className='board-modal-controls'>
                  <div className='board-modal-controls-head'>
                    <label className='pf-label'>WORKFLOW_STATUS</label>
                    {!isAdmin ? <span className='admin-lock'>ADMIN ONLY</span> : null}
                  </div>
                  <select
                    className='pf-input'
                    value={activeItem.status || 'open'}
                    onChange={(event) => updateStatus(activeItem.id, event.target.value)}
                    disabled={updatingStatus || !isAdmin}>
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <pre className='board-modal-body'>{activeItem.description}</pre>

                {activeItem.attachments && activeItem.attachments.length > 0 ? (
                  <div className='board-gallery'>
                    {activeItem.attachments.map((url) => (
                      <a key={url} href={url} target='_blank' rel='noreferrer' className='board-gallery-link'>
                        <img src={url} alt='Feedback attachment' className='board-gallery-image' loading='lazy' />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
