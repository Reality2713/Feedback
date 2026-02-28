'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';
type BodyTab = 'write' | 'preview';

type FeedbackFormProps = {
  userEmail?: string | null;
  isAdmin?: boolean;
};

type SelectedAttachment = {
  file: File;
  previewUrl: string;
};

const DRAFT_KEY = 'pf_feedback_draft_v1';

export function FeedbackForm({ userEmail, isAdmin = false }: FeedbackFormProps) {
  const uid = useId();
  const [state, setState] = useState<SubmitState>('idle');
  const [bodyTab, setBodyTab] = useState<BodyTab>('write');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<SelectedAttachment[]>([]);
  const isAuthenticated = Boolean(userEmail);
  const messageId = `${uid}-submit-message`;
  const descriptionPreviewId = `${uid}-description-preview`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { subject?: string; description?: string };
      setSubject(String(draft.subject || ''));
      setDescription(String(draft.description || ''));
    } catch {
      // Ignore invalid draft payload.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        subject,
        description,
      })
    );
  }, [subject, description]);

  useEffect(() => {
    attachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function onAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 4);

    setSelectedAttachments((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    });
  }

  function removeAttachment(index: number) {
    setSelectedAttachments((current) => {
      const next = [...current];
      const removed = next.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    setError('');

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    const safeSubject = subject.trim();
    const safeDescription = description.trim();
    if (!safeSubject || !safeDescription) {
      setError('Subject and details are required.');
      setState('error');
      return;
    }

    const payload = {
      type: String(formData.get('type') || 'FEATURE_REQUEST'),
      priority: String(formData.get('priority') || 'MEDIUM'),
      source: String(formData.get('source') || 'web'),
      reference: String(formData.get('reference') || ''),
      subject: safeSubject,
      description: safeDescription,
      email: String(formData.get('email') || ''),
      attachments: [] as string[],
    };

    try {
      const files = selectedAttachments.map((item) => item.file);

      if (files.length > 0) {
        setUploading(true);
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const uploadForm = new FormData();
            uploadForm.append('file', file);
            const uploadResponse = await fetch('/api/feedback/upload', {
              method: 'POST',
              body: uploadForm,
            });
            if (!uploadResponse.ok) {
              const uploadErr = (await uploadResponse.json()) as { error?: string };
              throw new Error(uploadErr.error || `Failed to upload ${file.name}`);
            }
            const data = (await uploadResponse.json()) as { url: string };
            return data.url;
          })
        );
        payload.attachments = uploaded;
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Transmission failed');
      }

      setState('success');
      formEl.reset();
      setSubject('');
      setDescription('');
      setBodyTab('write');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DRAFT_KEY);
      }
      setSelectedAttachments((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedback:created'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transmission failed');
      setState('error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form id='feedback-form' className='pf-card form-grid' onSubmit={onSubmit} aria-describedby={messageId}>
      <div className='two-col'>
        <div>
          <label htmlFor={`${uid}-type`} className='pf-label'>
            REPORT_TYPE
          </label>
          <select id={`${uid}-type`} name='type' className='pf-input'>
            <option>FEATURE_REQUEST</option>
            <option>BUG_REPORT</option>
            <option>IMPROVEMENT</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-priority`} className='pf-label'>
            SEVERITY
          </label>
          <select id={`${uid}-priority`} name='priority' className='pf-input'>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-subject`} className='pf-label'>
          SUBJECT_LINE
        </label>
        <input
          id={`${uid}-subject`}
          type='text'
          name='subject'
          placeholder='SUMMARY OF OBSERVATION'
          className='pf-input'
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
        />
      </div>

      {isAdmin ? (
        <div className='two-col'>
          <div>
            <label htmlFor={`${uid}-source`} className='pf-label'>
              SOURCE_CHANNEL
            </label>
            <select id={`${uid}-source`} name='source' className='pf-input' defaultValue='web'>
              <option value='web'>WEB_WIDGET</option>
              <option value='email'>EMAIL</option>
              <option value='discord'>DISCORD</option>
              <option value='x_twitter'>X_TWITTER</option>
              <option value='slack'>SLACK</option>
              <option value='other'>OTHER</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-reference`} className='pf-label'>
              REFERENCE_URL (OPTIONAL)
            </label>
            <input
              id={`${uid}-reference`}
              type='url'
              name='reference'
              placeholder='https://...'
              className='pf-input'
              pattern='https?://.*'
            />
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor={`${uid}-description`} className='pf-label'>
          DETAILED_SPECIFICATION
        </label>
        <div className='composer-tabs'>
          <button
            type='button'
            className={`sort-tab ${bodyTab === 'write' ? 'active' : ''}`}
            aria-pressed={bodyTab === 'write'}
            aria-controls={descriptionPreviewId}
            onClick={() => setBodyTab('write')}>
            WRITE
          </button>
          <button
            type='button'
            className={`sort-tab ${bodyTab === 'preview' ? 'active' : ''}`}
            aria-pressed={bodyTab === 'preview'}
            aria-controls={descriptionPreviewId}
            onClick={() => setBodyTab('preview')}>
            PREVIEW
          </button>
        </div>
        {bodyTab === 'write' ? (
          <textarea
            id={`${uid}-description`}
            name='description'
            rows={8}
            placeholder='PROVIDE TECHNICAL CONTEXT OR STEPS TO REPRODUCE...'
            className='pf-input pf-textarea'
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        ) : (
          <div id={descriptionPreviewId} className='pf-input markdown-preview' aria-live='polite'>
            {description.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
            ) : (
              <p className='board-note'>Nothing to preview yet.</p>
            )}
          </div>
        )}
        <p className='board-note'>Markdown supported: headings, lists, links, code, tables.</p>
      </div>

      {isAuthenticated ? (
        <div>
          <label htmlFor={`${uid}-operator`} className='pf-label'>
            OPERATOR_IDENT
          </label>
          <input id={`${uid}-operator`} type='text' value={userEmail || ''} className='pf-input' disabled readOnly />
        </div>
      ) : (
        <div>
          <label htmlFor={`${uid}-email`} className='pf-label'>
            OPERATOR_IDENT (EMAIL)
          </label>
          <input id={`${uid}-email`} type='email' name='email' placeholder='EMAIL@REALITY2713.COM' className='pf-input' required />
        </div>
      )}

      <div>
        <label htmlFor={`${uid}-attachments`} className='pf-label'>
          ATTACHMENTS (OPTIONAL, UP TO 4 IMAGES)
        </label>
        <input
          id={`${uid}-attachments`}
          ref={fileInputRef}
          type='file'
          name='attachments'
          className='pf-input'
          accept='image/png,image/jpeg,image/webp,image/gif'
          multiple
          onChange={onAttachmentSelection}
        />
        {selectedAttachments.length > 0 ? (
          <div className='attachment-preview-grid'>
            {selectedAttachments.map((item, index) => (
              <article key={`${item.file.name}-${index}`} className='attachment-preview'>
                <img src={item.previewUrl} alt={item.file.name} className='attachment-preview-image' />
                <div className='attachment-preview-meta'>
                  <p>{item.file.name}</p>
                  <p>{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button
                  type='button'
                  className='attachment-remove'
                  aria-label={`Remove attachment ${item.file.name}`}
                  onClick={() => removeAttachment(index)}>
                  REMOVE
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <button id='submit-btn' type='submit' className='pf-button' disabled={state === 'loading' || uploading}>
        <span>
          {state === 'loading' || uploading
            ? 'TRANSMITTING...'
            : state === 'success'
              ? 'TRANSMISSION_SUCCESS'
              : 'TRANSMIT_REPORT'}
        </span>
        <span>→</span>
      </button>

      {state === 'success' ? (
        <p id={messageId} className='pf-success' role='status' aria-live='polite'>
          Report filed. Mission control received your transmission.
        </p>
      ) : null}
      {state === 'error' ? (
        <p id={messageId} className='pf-error' role='alert'>
          {error}
        </p>
      ) : null}
    </form>
  );
}
