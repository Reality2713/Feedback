import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { DashboardKanban } from '@/components/dashboard-kanban';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/dashboard');
  }
  const isAdmin = isAdminEmail(user.email);

  return (
    <main className='pf-main dashboard-page'>
      <header className='pf-grid-header'>
        <div className='pf-brick'>AUTHENTICATED SESSION</div>
        <h1 className='hero-title'>MISSION CONTROL</h1>
        <p className='hero-meta'>
          Logged in as {user.email} {isAdmin ? '// ROLE: ADMIN' : '// ROLE: OPERATOR'}
        </p>
      </header>

      <section className='dashboard-layout'>
        <div className='pf-card'>
          <p className='hero-meta' style={{ marginTop: 0 }}>
            Dashboard access controls status transitions and roadmap flow.
          </p>
          <div style={{ marginTop: '0.9rem' }}>
            <SignOutButton />
          </div>
        </div>
        <DashboardKanban isAdmin={isAdmin} />
      </section>
    </main>
  );
}
