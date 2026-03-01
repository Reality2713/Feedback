'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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

type CommentItem = {
  id: string;
  created_at: string;
  author_email: string;
  author_role: 'user' | 'admin' | 'system';
  visibility?: 'public' | 'internal';
  body: string;
};

type NotificationPreferences = {
  status_updates: boolean;
  comment_updates: boolean;
  resolution_updates: boolean;
  archived_updates: boolean;
};

type ReportDetailViewProps = {
  id: string;
  currentUserEmail?: string | null;
  isAdmin?: boolean;
};

export function ReportDetailView({ id, currentUserEmail = null, isAdmin = false }: ReportDetailViewProps) {
  const [item, setItem] = useState<FeedbackItem | null>(null);
  const [allItems, setAllItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentEmail, setCommentEmail] = useState(currentUserEmail || '');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [commentLoading, setCommentLoading] = useState(false);
  const [preferenceEmail, setPreferenceEmail] = useState(currentUserEmail || '');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    status_updates: true,
    comment_updates: true,
    resolution_updates: true,
    archived_updates: true,
  });
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);

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
    setCommentEmail(currentUserEmail || '');
    setPreferenceEmail(currentUserEmail || '');
  }, [currentUserEmail]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const commentId = new URLSearchParams(window.location.search).get('comment');
    setHighlightedCommentId(commentId);
  }, []);

  useEffect(() => {
    async function loadPreferences() {
      const targetEmail = (currentUserEmail || preferenceEmail || '').trim();
      if (!targetEmail) return;
      try {
        const response = await fetch(`/api/feedback/${id}/notification-preferences?email=${encodeURIComponent(targetEmail)}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = (await response.json()) as { preferences?: NotificationPreferences };
        if (data.preferences) setPreferences(data.preferences);
      } catch {
        // keep page usable if preference load fails
      }
    }
    loadPreferences();
  }, [id, currentUserEmail, preferenceEmail]);

  useEffect(() => {
    async function loadComments() {
      try {
        const response = await fetch(`/api/feedback/${id}/comments`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { items?: CommentItem[] };
        setComments(data.items || []);
      } catch {
        // keep page usable if comments fail
      }
    }
    loadComments();
  }, [id]);

  useEffect(() => {
    if (!highlightedCommentId) return;
    const target = document.getElementById(`comment-${highlightedCommentId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [comments, highlightedCommentId]);

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

  useEffect(() => {
    if (!lightboxUrl) return;
    window.setTimeout(() => lightboxCloseRef.current?.focus(), 0);
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

  async function submitComment() {
    if (!commentBody.trim() || commentLoading) return;
    setCommentLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/feedback/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentBody.trim(),
          email: currentUserEmail ? undefined : commentEmail.trim(),
          visibility: isAdmin ? commentVisibility : 'public',
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to post comment');
      }
      const data = (await response.json()) as { item: CommentItem };
      setComments((current) => [...current, data.item]);
      setCommentBody('');
      if (isAdmin) setCommentVisibility('public');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setCommentLoading(false);
    }
  }

  async function savePreferences() {
    const email = (currentUserEmail || preferenceEmail || '').trim();
    if (!email || preferenceLoading) return;
    setPreferenceLoading(true);
    setPreferenceMessage('');
    try {
      const response = await fetch(`/api/feedback/${id}/notification-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUserEmail ? undefined : email,
          ...preferences,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to save preferences');
      }
      setPreferenceMessage('Notification preferences saved.');
    } catch (err) {
      setPreferenceMessage(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setPreferenceLoading(false);
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

      <section className='report-comments' aria-label='Report comments'>
        <p className='pf-label'>COMMENTS</p>
        {highlightedCommentId ? <p className='board-note'>Focused from notification email.</p> : null}
        <div className='report-comments-list'>
          {comments.length === 0 ? <p className='board-note'>No comments yet.</p> : null}
          {comments.map((comment) => (
            <article
              id={`comment-${comment.id}`}
              key={comment.id}
              className={`report-comment ${highlightedCommentId === comment.id ? 'highlighted' : ''}`}>
              <div className='report-comment-head'>
                <span className='meta-chip'>{comment.author_role.toUpperCase()}</span>
                {comment.visibility === 'internal' ? <span className='meta-chip'>INTERNAL</span> : null}
                <span>{comment.author_email}</span>
                <span>·</span>
                <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
              </div>
              <p>{comment.body}</p>
            </article>
          ))}
        </div>
        <div className='report-comment-form'>
          {currentUserEmail ? null : (
            <input
              type='email'
              className='pf-input'
              placeholder='your@email.com'
              value={commentEmail}
              onChange={(event) => setCommentEmail(event.target.value)}
            />
          )}
          <textarea
            rows={4}
            className='pf-input pf-textarea'
            placeholder='Add a comment...'
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          {isAdmin ? (
            <select
              className='pf-input'
              value={commentVisibility}
              onChange={(event) => setCommentVisibility(event.target.value as 'public' | 'internal')}>
              <option value='public'>PUBLIC_COMMENT</option>
              <option value='internal'>INTERNAL_NOTE</option>
            </select>
          ) : null}
          <button type='button' className='pf-button' disabled={commentLoading} onClick={submitComment}>
            <span>{commentLoading ? 'POSTING...' : 'POST_COMMENT'}</span>
            <span>→</span>
          </button>
        </div>
      </section>

      <section className='report-comments' aria-label='Notification preferences'>
        <p className='pf-label'>NOTIFICATION_PREFERENCES</p>
        {currentUserEmail ? null : (
          <input
            type='email'
            className='pf-input'
            placeholder='your@email.com'
            value={preferenceEmail}
            onChange={(event) => setPreferenceEmail(event.target.value)}
          />
        )}
        <div className='prefs-grid'>
          <label className='pref-option'>
            <input
              type='checkbox'
              checked={preferences.status_updates}
              onChange={(event) => setPreferences((current) => ({ ...current, status_updates: event.target.checked }))}
            />
            <span>Status updates</span>
          </label>
          <label className='pref-option'>
            <input
              type='checkbox'
              checked={preferences.comment_updates}
              onChange={(event) => setPreferences((current) => ({ ...current, comment_updates: event.target.checked }))}
            />
            <span>Comment updates</span>
          </label>
          <label className='pref-option'>
            <input
              type='checkbox'
              checked={preferences.resolution_updates}
              onChange={(event) => setPreferences((current) => ({ ...current, resolution_updates: event.target.checked }))}
            />
            <span>Resolution updates</span>
          </label>
          <label className='pref-option'>
            <input
              type='checkbox'
              checked={preferences.archived_updates}
              onChange={(event) => setPreferences((current) => ({ ...current, archived_updates: event.target.checked }))}
            />
            <span>Archive updates</span>
          </label>
        </div>
        <button type='button' className='pf-button' disabled={preferenceLoading} onClick={savePreferences}>
          <span>{preferenceLoading ? 'SAVING...' : 'SAVE_PREFERENCES'}</span>
          <span>→</span>
        </button>
        {preferenceMessage ? <p className='board-note'>{preferenceMessage}</p> : null}
      </section>

      {lightboxUrl ? (
        <div className='board-lightbox' role='dialog' aria-modal='true' aria-label='Attachment preview' onClick={() => setLightboxUrl(null)}>
          <button
            ref={lightboxCloseRef}
            type='button'
            className='lightbox-close'
            aria-label='Close attachment preview'
            onClick={() => setLightboxUrl(null)}>
            CLOSE
          </button>
          <img src={lightboxUrl} alt='Feedback attachment full size' className='board-lightbox-image' />
        </div>
      ) : null}
    </section>
  );
}
