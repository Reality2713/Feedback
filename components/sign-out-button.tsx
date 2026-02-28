'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export function SignOutButton() {
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  return (
    <button type='button' className='pf-button' onClick={signOut}>
      <span>SIGN_OUT</span>
      <span>→</span>
    </button>
  );
}

