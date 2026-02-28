'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type FeedbackItem = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  status: string | null;
  upvotes: number;
  attachments?: string[];
};

type ReportDetailViewProps = {
  id: string;
};

export function ReportDetailView({ id }: ReportDetailViewProps) {
  const [item, setItem] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const votedIds = JSON.parse(localStorage.getItem('pf_voted_feedback') || '[]') as string[];
    setVoted(votedIds.includes(id));
  }, [id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/feedback?sort=new', { cache: 'no-store' });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || 'Failed to load report');
        }
        const data = (await response.json()) as { items: FeedbackItem[] };
        const target = (data.items || []).find((entry) => entry.id === id);
        if (!target) {
          throw new Error('Report not found.');
        }
        setItem(target);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightboxUrl(null);
    }
    if (lightboxUrl) {
      window.addEventListener('keydown', onEscape);
      return () => {
        window.removeEventListener('keydown', onEscape);
      };
    }
  }, [lightboxUrl]);

  async function upvote() {
    if (!item || voted) return;
    try {
      const response = await fetch(`/api/feedback/${item.id}/upvote`, { method: 'POST' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Vote failed');
      }
      setItem((current) => (current ? { ...current, upvotes: current.upvotes + 1 } : current));
      if (typeof window !== 'undefined') {
        const votedIds = JSON.parse(localStorage.getItem('pf_voted_feedback') || '[]') as string[];
        localStorage.setItem('pf_voted_feedback', JSON.stringify([...votedIds, id]));
      }
      setVoted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    }
  }

  if (loading) {
    return <p className='board-note'>Loading report details...</p>;
  }

  if (error) {
    return (
      <div className='pf-card report-shell'>
        <p className='pf-error'>{error}</p>
        <Link href='/' className='modal-close report-back'>
          BACK_TO_FEEDBACK
        </Link>
      </div>
    );
  }

  if (!item) return null;

  return (
    <section className='pf-card report-shell'>
      <div className='report-head'>
        <Link href='/' className='modal-close report-back'>
          BACK
        </Link>
        <button type='button' className='vote-button' disabled={voted} onClick={upvote}>
          ▲ {item.upvotes}
        </button>
      </div>

      <h1 className='report-title'>{item.title}</h1>
      <p className='board-modal-meta'>
        {new Date(item.created_at).toLocaleString()} · {item.type || 'FEATURE_REQUEST'} · {item.priority || 'MEDIUM'} ·{' '}
        {item.status === 'open' ? 'NEW' : item.status?.toUpperCase()}
      </p>

      <div className='board-modal-body markdown-preview report-body'>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
      </div>

      {item.attachments && item.attachments.length > 0 ? (
        <div className='board-gallery'>
          {item.attachments.map((url) => (
            <button key={url} type='button' className='board-gallery-link' onClick={() => setLightboxUrl(url)}>
              <img src={url} alt='Feedback attachment' className='board-gallery-image' loading='lazy' />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxUrl ? (
        <div className='board-lightbox' onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt='Feedback attachment full size' className='board-lightbox-image' />
        </div>
      ) : null}
    </section>
  );
}
