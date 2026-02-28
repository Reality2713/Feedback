'use client';

import { useEffect, useState } from 'react';

type RoadmapItem = {
  id: string;
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

export function RoadmapBoard() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [error, setError] = useState('');

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

  return (
    <section className='pf-card roadmap-card'>
      <div className='board-header'>
        <h3>ROADMAP</h3>
      </div>
      {error ? <p className='pf-error'>{error}</p> : null}

      <div className='roadmap-grid'>
        {LANES.map((lane) => {
          const laneItems = items.filter((item) => item.status === lane.key);
          return (
            <div key={lane.key} className='roadmap-lane'>
              <p className='roadmap-lane-title'>{lane.label}</p>
              <div className='roadmap-lane-items'>
                {laneItems.map((item) => (
                  <article key={item.id} className='roadmap-item'>
                    <h4>{item.title}</h4>
                    <p>{item.preview || 'No preview available.'}</p>
                  </article>
                ))}
                {laneItems.length === 0 ? <p className='board-note'>No items.</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
