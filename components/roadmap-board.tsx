'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type RoadmapItem = {
  id: string;
  created_at: string;
  title: string;
  preview?: string;
  status: 'open' | 'planned' | 'in_progress' | 'shipped';
};

type Lane = {
  key: 'planned' | 'in_progress' | 'shipped';
  label: string;
};

const LANES: Lane[] = [
  { key: 'planned', label: 'PLANNED' },
  { key: 'in_progress', label: 'IN_PROGRESS' },
  { key: 'shipped', label: 'SHIPPED' },
];

type RoadmapBoardProps = {
  mode?: 'compact' | 'full';
};

export function RoadmapBoard({ mode = 'compact' }: RoadmapBoardProps) {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function loadRoadmap() {
    setError('');
    try {
      const response = await fetch('/api/feedback?status=planned,in_progress,shipped&sort=new', {
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to load roadmap');
      }
      const data = (await response.json()) as { items: RoadmapItem[] };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap');
    }
  }

  useEffect(() => {
    loadRoadmap();
  }, []);

  useEffect(() => {
    function onChanged() {
      loadRoadmap();
    }

    window.addEventListener('feedback:created', onChanged);
    window.addEventListener('feedback:status-updated', onChanged);
    return () => {
      window.removeEventListener('feedback:created', onChanged);
      window.removeEventListener('feedback:status-updated', onChanged);
    };
  }, []);

  const filteredItems = search.trim()
    ? items.filter((item) =>
        [item.title, item.preview]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
    : items;

  return (
    <section className='pf-card roadmap-card' aria-label='Roadmap board'>
      <div className='board-header'>
        <h3>ROADMAP</h3>
      </div>
      {mode === 'full' ? (
        <div className='roadmap-tools'>
          <label htmlFor='roadmap-search' className='sr-only'>
            Search roadmap
          </label>
          <input
            id='roadmap-search'
            type='search'
            className='pf-input board-search'
            placeholder='Search roadmap...'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className='pf-error'>{error}</p> : null}

      <div className='roadmap-grid'>
        {LANES.map((lane) => {
          const laneItems = filteredItems.filter((item) => item.status === lane.key);
          return (
            <div key={lane.key} className='roadmap-lane'>
              <h4 className='roadmap-lane-title'>{lane.label}</h4>
              <div className='roadmap-lane-items'>
                {laneItems.map((item) =>
                  mode === 'full' ? (
                    <Link key={item.id} href={`/report/${item.id}`} className='roadmap-item roadmap-link-item'>
                      <h4>{item.title}</h4>
                      <p>{item.preview || 'No preview available.'}</p>
                      <p className='roadmap-item-date'>{new Date(item.created_at).toLocaleDateString()}</p>
                    </Link>
                  ) : (
                    <article key={item.id} className='roadmap-item'>
                      <h4>{item.title}</h4>
                      <p>{item.preview || 'No preview available.'}</p>
                    </article>
                  )
                )}
                {laneItems.length === 0 ? <p className='board-note'>No items.</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
