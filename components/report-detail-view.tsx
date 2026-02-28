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
  const [allItems, setAllItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [copied, setCopied] = useState(false);

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
        const entries = data.items || [];
        setAllItems(entries);
        const target = entries.find((entry) => entry.id === id);
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

  async function copyLink() {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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

  const related = allItems.filter((entry) => entry.id !== item.id).slice(0, 3);

  return (
    <section className='pf-card report-shell' aria-labelledby='report-title'>
      <div className='report-head'>
        <Link href='/' className='modal-close report-back'>
          BACK
        </Link>
        <div className='report-actions'>
          <button type='button' className='modal-close' onClick={copyLink}>
            {copied ? 'COPIED' : 'COPY_LINK'}
          </button>
          <button type='button' className='vote-button' aria-label={`Upvote ${item.title}`} disabled={voted} onClick={upvote}>
            ▲ {item.upvotes}
          </button>
        </div>
      </div>

      <h1 id='report-title' className='report-title'>
        {item.title}
      </h1>
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
            <button
              key={url}
              type='button'
              className='board-gallery-link'
              aria-label='Open attachment preview'
              onClick={() => setLightboxUrl(url)}>
              <img src={url} alt='Feedback attachment' className='board-gallery-image' loading='lazy' />
            </button>
          ))}
        </div>
      ) : (
        <p className='board-note'>No attachments on this report.</p>
      )}

      {related.length > 0 ? (
        <div className='report-related'>
          <p className='pf-label'>RELATED_REPORTS</p>
          <div className='report-related-grid'>
            {related.map((entry) => (
              <Link key={entry.id} href={`/report/${entry.id}`} className='report-related-item'>
                <h4>{entry.title}</h4>
                <p>{entry.description.split('\n').find((line) => line.trim()) || 'No details.'}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {lightboxUrl ? (
        <div className='board-lightbox' role='dialog' aria-modal='true' aria-label='Attachment preview' onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt='Feedback attachment full size' className='board-lightbox-image' />
        </div>
      ) : null}
    </section>
  );
}
