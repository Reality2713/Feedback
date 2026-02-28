'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SortMode = 'new' | 'popular' | 'trending';
type StatusFilter = 'all' | 'open' | 'planned' | 'in_progress' | 'shipped';

type FeedbackItem = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  preview?: string;
  type?: string;
  priority?: string;
  source?: string;
  reference?: string;
  status: string | null;
  upvotes: number;
  attachments?: string[];
};

type FeedbackBoardProps = {
  embedded?: boolean;
  isAdmin?: boolean;
};

const SORTS: SortMode[] = ['new', 'popular', 'trending'];
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'ALL' },
  { value: 'open', label: 'NEW' },
  { value: 'planned', label: 'PLANNED' },
  { value: 'in_progress', label: 'IN_PROGRESS' },
  { value: 'shipped', label: 'SHIPPED' },
];
const STATUSES = [
  { value: 'open', label: 'NEW' },
  { value: 'planned', label: 'PLANNED' },
  { value: 'in_progress', label: 'IN_PROGRESS' },
  { value: 'shipped', label: 'SHIPPED' },
] as const;

export function FeedbackBoard({ embedded = false, isAdmin = false }: FeedbackBoardProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [sort, setSort] = useState<SortMode>('new');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [voted, setVoted] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<FeedbackItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeDialogId, setActiveDialogId] = useState('');
  const returnFocusRef = useRef<HTMLElement | null>(null);

  async function loadFeedback(currentSort: SortMode, currentStatus: StatusFilter, onSuccess?: (items: FeedbackItem[]) => void) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ sort: currentSort });
      if (currentStatus !== 'all') {
        query.set('status', currentStatus);
      }

      const response = await fetch(`/api/feedback?${query.toString()}`, { cache: 'no-store' });
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
    if (!mounted) return;
    const reportId = new URLSearchParams(window.location.search).get('report');
    if (!reportId) return;
    const target = items.find((item) => item.id === reportId);
    if (target) setActiveItem(target);
  }, [items, mounted]);

  useEffect(() => {
    let cancelled = false;
    loadFeedback(sort, statusFilter, (nextItems) => {
      if (!cancelled) setItems(nextItems);
    });
    return () => {
      cancelled = true;
    };
  }, [sort, statusFilter]);

  useEffect(() => {
    function onCreated() {
      loadFeedback(sort, statusFilter, (nextItems) => setItems(nextItems));
    }

    window.addEventListener('feedback:created', onCreated);
    return () => {
      window.removeEventListener('feedback:created', onCreated);
    };
  }, [sort, statusFilter]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (lightboxUrl) {
        setLightboxUrl(null);
        return;
      }
      setActiveItem(null);
    }

    if (activeItem) {
      window.addEventListener('keydown', onEscape);
      return () => {
        window.removeEventListener('keydown', onEscape);
      };
    }
  }, [activeItem, lightboxUrl]);

  useEffect(() => {
    if (!activeItem) return;
    const nextId = `report-dialog-${activeItem.id}`;
    setActiveDialogId(nextId);
    window.setTimeout(() => {
      const closeButton = document.getElementById(`${nextId}-close`);
      closeButton?.focus();
    }, 0);
  }, [activeItem]);

  const votedIds = useMemo(() => new Set(voted), [voted]);
  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const haystack = [item.title, item.preview, item.description, item.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchTerm]);

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

  function openItem(item: FeedbackItem, trigger?: HTMLElement) {
    returnFocusRef.current = trigger ?? null;
    setActiveItem(item);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('report', item.id);
    window.history.replaceState({}, '', url.toString());
  }

  function closeItem() {
    setActiveItem(null);
    setCopied(false);
    if (returnFocusRef.current) setTimeout(() => returnFocusRef.current?.focus(), 0);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('report');
    window.history.replaceState({}, '', url.toString());
  }

  async function copyReportLink() {
    if (!activeItem || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('report', activeItem.id);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const wrapperClass = embedded ? 'board-card embedded' : 'pf-card board-card';

  return (
    <section className={wrapperClass} aria-label='Mission board'>
      <div className='board-header'>
        <h3>MISSION BOARD</h3>
        <div className='sort-tabs'>
          {SORTS.map((value) => (
            <button
              key={value}
              type='button'
              className={`sort-tab ${sort === value ? 'active' : ''}`}
              aria-pressed={sort === value}
              onClick={() => setSort(value)}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className='board-tools'>
        <div className='status-tabs'>
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type='button'
              className={`sort-tab ${statusFilter === filter.value ? 'active' : ''}`}
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <label htmlFor='board-search' className='sr-only'>
          Search reports
        </label>
        <input
          id='board-search'
          type='search'
          className='pf-input board-search'
          placeholder='Search reports...'
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {loading ? <p className='board-note'>Loading feedback stream...</p> : null}
      {error ? <p className='pf-error'>{error}</p> : null}

      <div className='board-list'>
        {visibleItems.map((item) => (
          <article key={item.id} className='board-item'>
            <div className='board-item-head'>
              <button
                type='button'
                className='board-open'
                onClick={(event) => openItem(item, event.currentTarget)}
                aria-label={`Open full report ${item.title}`}>
                <h4>{item.title}</h4>
              </button>
              <button
                type='button'
                className='vote-button'
                aria-label={`Upvote ${item.title}`}
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
        {!loading && visibleItems.length === 0 ? <p className='board-note'>No missions matched your filters.</p> : null}
      </div>

      {mounted && activeItem
        ? createPortal(
            <div className='board-modal-backdrop' onClick={closeItem}>
              <div
                id={activeDialogId}
                className='board-modal'
                role='dialog'
                aria-modal='true'
                aria-labelledby={`${activeDialogId}-title`}
                onClick={(event) => event.stopPropagation()}>
                <div className='board-modal-head'>
                  <h4 id={`${activeDialogId}-title`}>{activeItem.title}</h4>
                  <div className='board-modal-actions'>
                    <a className='modal-close' href={`/report/${activeItem.id}`}>
                      OPEN_PAGE
                    </a>
                    <button type='button' className='modal-close' onClick={copyReportLink}>
                      {copied ? 'COPIED' : 'COPY_LINK'}
                    </button>
                    <button id={`${activeDialogId}-close`} type='button' className='modal-close' onClick={closeItem}>
                      CLOSE
                    </button>
                  </div>
                </div>

                <p className='board-modal-meta'>
                  {new Date(activeItem.created_at).toLocaleString()} · {activeItem.type || 'FEATURE_REQUEST'} ·{' '}
                  {activeItem.priority || 'MEDIUM'} {isAdmin ? `· ${activeItem.source || 'web'} ` : ''}·{' '}
                  {activeItem.status === 'open' ? 'NEW' : activeItem.status?.toUpperCase()}
                </p>
                {isAdmin && activeItem.reference ? (
                  <a href={activeItem.reference} target='_blank' rel='noreferrer' className='board-reference-link'>
                    SOURCE_REFERENCE ↗
                  </a>
                ) : null}

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
                <div className='board-modal-body markdown-preview'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeItem.description}</ReactMarkdown>
                </div>

                {activeItem.attachments && activeItem.attachments.length > 0 ? (
                  <div className='board-gallery'>
                    {activeItem.attachments.map((url) => (
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
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && lightboxUrl
        ? createPortal(
            <div className='board-lightbox' role='dialog' aria-modal='true' aria-label='Attachment preview' onClick={() => setLightboxUrl(null)}>
              <button
                type='button'
                className='lightbox-close'
                aria-label='Close attachment preview'
                onClick={() => setLightboxUrl(null)}>
                CLOSE
              </button>
              <img src={lightboxUrl} alt='Feedback attachment full size' className='board-lightbox-image' />
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
