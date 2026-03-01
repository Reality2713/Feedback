'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type IntakeEvent = {
  id: string;
  created_at: string;
  source: string;
  reference_url?: string | null;
  reporter_email?: string | null;
  event_type: string;
  payload?: {
    title?: string;
    type?: string;
    priority?: string;
    attachments_count?: number;
  };
  feedback_id?: string | null;
};

export function IntakeFeed() {
  const [items, setItems] = useState<IntakeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/intake?limit=30', { cache: 'no-store' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to load intake feed');
      }
      const data = (await response.json()) as { items: IntakeEvent[] };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intake feed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className='pf-card dashboard-card'>
      <div className='dashboard-head'>
        <div>
          <h2 className='section-title dashboard-title'>INTAKE LOG</h2>
          <p className='hero-meta'>Canonical ingestion stream across all channels.</p>
        </div>
        <button type='button' className='pf-button dashboard-refresh' onClick={load} disabled={loading}>
          <span>{loading ? 'SYNCING...' : 'REFRESH'}</span>
          <span>↻</span>
        </button>
      </div>
      {error ? <p className='pf-error'>{error}</p> : null}
      <div className='dashboard-items'>
        {items.map((item) => (
          <article key={item.id} className='dashboard-item'>
            <h4>{item.payload?.title || 'Untitled intake event'}</h4>
            <div className='dashboard-item-meta'>
              <span>{new Date(item.created_at).toLocaleString()}</span>
              <span>{item.source?.toUpperCase() || 'WEB'}</span>
              <span>{item.event_type?.toUpperCase() || 'SUBMISSION'}</span>
              <span>{item.payload?.type || 'FEATURE_REQUEST'}</span>
              <span>{item.payload?.priority || 'MEDIUM'}</span>
              <span>{item.payload?.attachments_count || 0} img</span>
            </div>
            <div className='dashboard-item-meta'>
              {item.reporter_email ? <span>{item.reporter_email}</span> : null}
              {item.reference_url ? (
                <a href={item.reference_url} className='dashboard-ref-link' target='_blank' rel='noreferrer'>
                  ref↗
                </a>
              ) : null}
              {item.feedback_id ? (
                <>
                  <Link href={`/dashboard/report/${item.feedback_id}`} className='dashboard-ref-link'>
                    admin↗
                  </Link>
                  <Link href={`/report/${item.feedback_id}`} className='dashboard-ref-link'>
                    public↗
                  </Link>
                </>
              ) : null}
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className='board-note'>No intake events yet.</p> : null}
      </div>
    </section>
  );
}
