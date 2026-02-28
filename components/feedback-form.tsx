'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent as ReactDragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';
type BodyTab = 'write' | 'preview';

type FeedbackFormProps = {
  userEmail?: string | null;
  isAdmin?: boolean;
};

type SelectedAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'ready' | 'uploading' | 'uploaded' | 'error';
  error?: string;
};

const DRAFT_KEY = 'pf_feedback_draft_v1';
const MAX_CLIENT_ATTACHMENT_MB = 8;

export function FeedbackForm({ userEmail, isAdmin = false }: FeedbackFormProps) {
  const uid = useId();
  const [state, setState] = useState<SubmitState>('idle');
  const [bodyTab, setBodyTab] = useState<BodyTab>('write');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
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

  function applyAttachmentFiles(files: File[]) {
    const limited = files.slice(0, 4);
    const onlyImages = limited.filter((file) => file.type.startsWith('image/'));
    if (onlyImages.length === 0) {
      setError('Only image attachments are supported.');
      setState('error');
      return;
    }
    if (onlyImages.length !== limited.length) {
      setError('Some dropped files were ignored because they are not images.');
      setState('error');
    }

    const tooLarge = onlyImages.find((file) => file.size > MAX_CLIENT_ATTACHMENT_MB * 1024 * 1024);
    if (tooLarge) {
      setError(`Attachment ${tooLarge.name} exceeds ${MAX_CLIENT_ATTACHMENT_MB}MB.`);
      setState('error');
      return;
    }

    setSelectedAttachments((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return onlyImages.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'ready' as const,
      }));
    });
    if (onlyImages.length === limited.length) {
      setError('');
      setState('idle');
    }
  }

  function onAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    applyAttachmentFiles(Array.from(event.target.files || []));
    event.currentTarget.value = '';
  }

  function hasDraggedFiles(event: ReactDragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes('Files');
  }

  function onFormDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragActive(true);
  }

  function onFormDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragActive(false);
    }
  }

  function onFormDrop(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    applyAttachmentFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      const files = selectedAttachments.map((item) => ({ id: item.id, file: item.file }));

      if (files.length > 0) {
        setUploading(true);
        const uploaded: string[] = [];
        for (const attachment of files) {
          setSelectedAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, status: 'uploading', error: undefined } : item
            )
          );
          const uploadForm = new FormData();
          uploadForm.append('file', attachment.file);
          const uploadResponse = await fetch('/api/feedback/upload', {
            method: 'POST',
            body: uploadForm,
          });
          if (!uploadResponse.ok) {
            const uploadErr = (await uploadResponse.json()) as { error?: string };
            const message = uploadErr.error || `Failed to upload ${attachment.file.name}`;
            setSelectedAttachments((current) =>
              current.map((item) => (item.id === attachment.id ? { ...item, status: 'error', error: message } : item))
            );
            throw new Error(message);
          }
          const data = (await uploadResponse.json()) as { url: string };
          uploaded.push(data.url);
          setSelectedAttachments((current) =>
            current.map((item) => (item.id === attachment.id ? { ...item, status: 'uploaded' } : item))
          );
        }
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

  function insertMarkdown(before: string, after = '') {
    const textarea = descriptionRef.current;
    const start = textarea?.selectionStart ?? description.length;
    const end = textarea?.selectionEnd ?? description.length;
    const selected = description.slice(start, end);
    const insertion = `${before}${selected || 'text'}${after}`;
    const next = `${description.slice(0, start)}${insertion}${description.slice(end)}`;
    setDescription(next);
    setBodyTab('write');
    window.setTimeout(() => {
      if (!textarea) return;
      textarea.focus();
      const cursor = start + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function onDescriptionKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      insertMarkdown('**', '**');
    }
    if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      insertMarkdown('*', '*');
    }
  }

  return (
    <form
      id='feedback-form'
      className={`pf-card form-grid ${dragActive ? 'drag-active' : ''}`}
      onSubmit={onSubmit}
      onDragOverCapture={onFormDragOver}
      onDragLeaveCapture={onFormDragLeave}
      onDropCapture={onFormDrop}
      aria-describedby={messageId}>
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
        <div className='composer-toolbar' aria-label='Markdown formatting tools'>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('**', '**')}>
            Bold
          </button>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('*', '*')}>
            Italic
          </button>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('`', '`')}>
            Code
          </button>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('\n- ', '')}>
            List
          </button>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('[text](', ')')}>
            Link
          </button>
          <button type='button' className='tool-btn' onClick={() => insertMarkdown('\n| header | value |\n| --- | --- |\n| cell | cell |\n')}>
            Table
          </button>
        </div>
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
            ref={descriptionRef}
            name='description'
            rows={8}
            placeholder='PROVIDE TECHNICAL CONTEXT OR STEPS TO REPRODUCE...'
            className='pf-input pf-textarea'
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={onDescriptionKeyDown}
            onDragOver={(event) => {
              if (!hasDraggedFiles(event)) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!hasDraggedFiles(event)) return;
              event.preventDefault();
            }}
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
        <p className='board-note'>Markdown supported: headings, lists, links, code, tables. Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I.</p>
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
              <article key={item.id} className='attachment-preview'>
                <img src={item.previewUrl} alt={item.file.name} className='attachment-preview-image' />
                <div className='attachment-preview-meta'>
                  <p className='attachment-filename'>{item.file.name}</p>
                  <p>{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <p className={`attachment-state ${item.status}`}>{item.status.toUpperCase()}</p>
                  {item.error ? <p className='attachment-error'>{item.error}</p> : null}
                </div>
                <button
                  type='button'
                  className='attachment-remove'
                  aria-label={`Remove attachment ${item.file.name}`}
                  disabled={item.status === 'uploading'}
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
