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
  dedupe_key?: string | null;
  converted_at?: string | null;
  converted_by?: string | null;
};

export function IntakeFeed() {
  const [items, setItems] = useState<IntakeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [source, setSource] = useState('other');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

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

  async function createManualIntake() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          title: title.trim(),
          notes: notes.trim(),
          reporter_email: reporterEmail.trim(),
          reference_url: referenceUrl.trim(),
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to capture intake');
      }
      setTitle('');
      setNotes('');
      setReporterEmail('');
      setReferenceUrl('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture intake');
    } finally {
      setSubmitting(false);
    }
  }

  async function convertIntake(id: string) {
    setRowBusy((state) => ({ ...state, [id]: true }));
    setError('');
    try {
      const response = await fetch(`/api/intake/${id}/convert`, { method: 'POST' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to convert intake');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert intake');
    } finally {
      setRowBusy((state) => ({ ...state, [id]: false }));
    }
  }

  async function linkIntake(id: string) {
    const feedbackId = String(linkDrafts[id] || '').trim();
    if (!feedbackId) return;
    setRowBusy((state) => ({ ...state, [id]: true }));
    setError('');
    try {
      const response = await fetch(`/api/intake/${id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to link intake');
      }
      setLinkDrafts((state) => ({ ...state, [id]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link intake');
    } finally {
      setRowBusy((state) => ({ ...state, [id]: false }));
    }
  }

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

      <div className='intake-capture'>
        <p className='pf-label'>MANUAL_CAPTURE</p>
        <div className='two-col'>
          <select className='pf-input' value={source} onChange={(event) => setSource(event.target.value)}>
            <option value='email'>EMAIL</option>
            <option value='discord'>DISCORD</option>
            <option value='x_twitter'>X_TWITTER</option>
            <option value='slack'>SLACK</option>
            <option value='other'>OTHER</option>
          </select>
          <input
            className='pf-input'
            type='email'
            placeholder='reporter@email.com'
            value={reporterEmail}
            onChange={(event) => setReporterEmail(event.target.value)}
          />
        </div>
        <input
          className='pf-input'
          type='text'
          placeholder='Intake title / summary'
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          className='pf-input'
          type='url'
          placeholder='https://source-link...'
          value={referenceUrl}
          onChange={(event) => setReferenceUrl(event.target.value)}
        />
        <textarea
          className='pf-input pf-textarea'
          rows={3}
          placeholder='Context / notes / original message...'
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button type='button' className='pf-button' onClick={createManualIntake} disabled={submitting}>
          <span>{submitting ? 'CAPTURING...' : 'CAPTURE_INTAKE'}</span>
          <span>→</span>
        </button>
      </div>

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
            {item.dedupe_key ? <p className='board-note'>dedupe: {item.dedupe_key}</p> : null}
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
            {!item.feedback_id ? (
              <div className='intake-actions'>
                <button
                  type='button'
                  className='modal-close'
                  disabled={Boolean(rowBusy[item.id])}
                  onClick={() => convertIntake(item.id)}>
                  {rowBusy[item.id] ? 'WORKING...' : 'CREATE_FEEDBACK'}
                </button>
                <input
                  className='pf-input'
                  placeholder='Existing feedback UUID'
                  value={linkDrafts[item.id] || ''}
                  onChange={(event) => setLinkDrafts((state) => ({ ...state, [item.id]: event.target.value }))}
                />
                <button
                  type='button'
                  className='modal-close'
                  disabled={Boolean(rowBusy[item.id]) || !String(linkDrafts[item.id] || '').trim()}
                  onClick={() => linkIntake(item.id)}>
                  LINK_EXISTING
                </button>
              </div>
            ) : (
              <p className='board-note'>
                linked at {item.converted_at ? new Date(item.converted_at).toLocaleString() : 'unknown'} by {item.converted_by || 'system'}
              </p>
            )}
          </article>
        ))}
        {!loading && items.length === 0 ? <p className='board-note'>No intake events yet.</p> : null}
      </div>
    </section>
  );
}
