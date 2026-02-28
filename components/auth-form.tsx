'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type Mode = 'login' | 'signup';

export function AuthForm({ mode, nextPath }: { mode: Mode; nextPath: string }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const safeNext = nextPath.startsWith('/') ? nextPath : '/dashboard';
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  }, [nextPath]);

  async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth is not configured.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage('Magic link sent. Check your inbox.');
      setEmail('');
      setFullName('');
    }
    setLoading(false);
  }

  async function signInWithOAuth(provider: 'github' | 'google') {
    setLoading(true);
    setMessage('');
    setError('');

    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth is not configured.');
      setLoading(false);
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <form className='pf-card auth-form' onSubmit={sendMagicLink}>
      <p className='pf-label'>AUTH_METHOD</p>
      {mode === 'signup' ? (
        <input
          type='text'
          name='full_name'
          placeholder='FULL NAME'
          className='pf-input'
          value={fullName}
          onChange={(e) => setFullName(e.currentTarget.value)}
        />
      ) : null}
      <input
        type='email'
        name='email'
        placeholder='EMAIL@REALITY2713.COM'
        className='pf-input'
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
        required
      />
      <button type='submit' className='pf-button' disabled={loading}>
        <span>{loading ? 'PROCESSING...' : mode === 'signup' ? 'REGISTER_WITH_MAGIC_LINK' : 'LOGIN_WITH_MAGIC_LINK'}</span>
        <span>→</span>
      </button>

      <div className='auth-separator'>OR OAUTH</div>
      <div className='auth-oauth-row'>
        <button type='button' className='pf-button oauth' disabled={loading} onClick={() => signInWithOAuth('github')}>
          <span>GITHUB</span>
          <span>↗</span>
        </button>
        <button type='button' className='pf-button oauth' disabled={loading} onClick={() => signInWithOAuth('google')}>
          <span>GOOGLE</span>
          <span>↗</span>
        </button>
      </div>

      {message ? <p className='pf-success'>{message}</p> : null}
      {error ? <p className='pf-error'>{error}</p> : null}
    </form>
  );
}
