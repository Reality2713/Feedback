import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/dashboard');
  }

  return (
    <main className='auth-page'>
      <section className='auth-shell'>
        <div className='pf-brick'>AUTHENTICATED SESSION</div>
        <h1 className='hero-title'>MISSION CONTROL</h1>
        <p className='hero-meta'>Logged in as {user.email}</p>
        <div className='pf-card' style={{ marginBottom: '1rem' }}>
          <p>Dashboard scaffold is active. Next milestone: kanban + roadmap modules.</p>
        </div>
        <SignOutButton />
      </section>
    </main>
  );
}

