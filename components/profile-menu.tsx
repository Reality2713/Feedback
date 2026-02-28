'use client';

import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type ProfileMenuProps = {
  email: string;
};

export function ProfileMenu({ email }: ProfileMenuProps) {
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  return (
    <details className='profile-menu'>
      <summary className='profile-trigger' aria-label='Open profile menu'>
        <span className='profile-dot' />
        <span>{email}</span>
      </summary>
      <div className='profile-panel' role='menu' aria-label='Profile actions'>
        <Link href='/dashboard' className='profile-link' role='menuitem'>
          Dashboard
        </Link>
        <button type='button' className='profile-link' role='menuitem' onClick={signOut}>
          Sign out
        </button>
      </div>
    </details>
  );
}
