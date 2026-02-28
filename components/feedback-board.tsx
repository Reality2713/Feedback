'use client';

import { useEffect, useMemo, useState } from 'react';

type SortMode = 'new' | 'popular' | 'trending';

type FeedbackItem = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  status: string | null;
  upvotes: number;
};

type FeedbackBoardProps = {
  embedded?: boolean;
};

const SORTS: SortMode[] = ['new', 'popular', 'trending'];

export function FeedbackBoard({ embedded = false }: FeedbackBoardProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [sort, setSort] = useState<SortMode>('new');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [voted, setVoted] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setVoted(JSON.parse(localStorage.getItem('pf_voted_feedback') || '[]') as string[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/feedback?sort=${sort}`, { cache: 'no-store' });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Failed to load feedback');
        }
        const data = (await response.json()) as { items: FeedbackItem[] };
        if (!cancelled) setItems(data.items || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load feedback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
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
              <h4>{item.title}</h4>
              <button
                type='button'
                className='vote-button'
                disabled={Boolean(voting[item.id]) || votedIds.has(item.id)}
                onClick={() => upvote(item.id)}>
                ▲ {item.upvotes}
              </button>
            </div>
            <p>{item.description.split('\n').slice(-1)[0]}</p>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className='board-note'>No missions logged yet.</p> : null}
      </div>
    </section>
  );
}
