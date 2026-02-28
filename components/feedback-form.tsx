'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function FeedbackForm() {
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    setError('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      type: String(formData.get('type') || 'FEATURE_REQUEST'),
      priority: String(formData.get('priority') || 'MEDIUM'),
      subject: String(formData.get('subject') || ''),
      description: String(formData.get('description') || ''),
      email: String(formData.get('email') || ''),
    };

    try {
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
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transmission failed');
      setState('error');
    }
  }

  return (
    <form id='feedback-form' className='pf-card form-grid' onSubmit={onSubmit}>
      <div className='two-col'>
        <div>
          <label className='pf-label'>REPORT_TYPE</label>
          <select name='type' className='pf-input'>
            <option>FEATURE_REQUEST</option>
            <option>BUG_REPORT</option>
            <option>IMPROVEMENT</option>
          </select>
        </div>
        <div>
          <label className='pf-label'>SEVERITY</label>
          <select name='priority' className='pf-input'>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </div>
      </div>

      <div>
        <label className='pf-label'>SUBJECT_LINE</label>
        <input type='text' name='subject' placeholder='SUMMARY OF OBSERVATION' className='pf-input' required />
      </div>

      <div>
        <label className='pf-label'>DETAILED_SPECIFICATION</label>
        <textarea
          name='description'
          rows={6}
          placeholder='PROVIDE TECHNICAL CONTEXT OR STEPS TO REPRODUCE...'
          className='pf-input pf-textarea'
          required
        />
      </div>

      <div>
        <label className='pf-label'>OPERATOR_IDENT (EMAIL)</label>
        <input type='email' name='email' placeholder='EMAIL@REALITY2713.COM' className='pf-input' required />
      </div>

      <button id='submit-btn' type='submit' className='pf-button' disabled={state === 'loading'}>
        <span>
          {state === 'loading' ? 'TRANSMITTING...' : state === 'success' ? 'TRANSMISSION_SUCCESS' : 'TRANSMIT_REPORT'}
        </span>
        <span>→</span>
      </button>

      {state === 'success' ? <p className='pf-success'>Report filed. Mission control received your transmission.</p> : null}
      {state === 'error' ? <p className='pf-error'>{error}</p> : null}
    </form>
  );
}
