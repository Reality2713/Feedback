import Link from 'next/link';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackBoard } from '@/components/feedback-board';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function HomePage() {
  let userEmail: string | null = null;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    userEmail = null;
  }

  return (
    <>
      <aside className='pf-spine'>
        <div className='pf-logo'>PF</div>
        <div className='spacer' />
        <div className='spine-meta'>
          <span>SQ-2713</span>
          <span>MISSION CONTROL</span>
        </div>
      </aside>

      <main className='pf-main'>
        <header className='pf-grid-header'>
          <div className='pf-brick'>PROTOCOL 004 · FEEDBACK TERMINAL</div>
          <h1 className='hero-title'>
            MISSIONS &
            <br />
            REPORTS
          </h1>
          <p className='hero-meta'>
            PREFLIGHT INSPECTION SERVICE // VERSION 3.0 // DEPLOYMENT: REALITYCHECK
          </p>
        </header>

        <section className='content-grid'>
          <div className='left-col'>
            <h2 className='section-title'>FILE NEW REPORT</h2>
            <FeedbackForm userEmail={userEmail} />
          </div>

          <div className='right-col'>
            <div className='pf-card status-card'>
              <div className='status-pill'>DPT_LOG_v3.0</div>
              <h2 className='status-title'>
                MISSION
                <br />
                STATUS
              </h2>
              <div className='status-copy'>
                <p>Reports submitted through this terminal are routed to the Preflight engineering core.</p>
                <div className='status-note'>
                  <p>[ SYSTEM_ADVISORY ]</p>
                  <p>Voting, roadmap, and kanban flows will be available in authenticated app mode.</p>
                </div>
              </div>
              <Link href='/dashboard' className='pf-button invert'>
                <span>ACCESS_ROADMAP_BOARD</span>
                <span>→</span>
              </Link>
              <div className='home-auth-links'>
                <Link href='/auth/login'>Login</Link>
                <span>·</span>
                <Link href='/auth/signup'>Register</Link>
              </div>
            </div>
            <FeedbackBoard />
          </div>
        </section>
      </main>
    </>
  );
}
