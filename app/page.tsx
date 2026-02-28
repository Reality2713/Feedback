import Link from 'next/link';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackBoard } from '@/components/feedback-board';
import { ProfileMenu } from '@/components/profile-menu';
import { RoadmapBoard } from '@/components/roadmap-board';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

export default async function HomePage() {
  let userEmail: string | null = null;
  let userIsAdmin = false;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
    userIsAdmin = isAdminEmail(userEmail);
  } catch {
    userEmail = null;
    userIsAdmin = false;
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

      <main id='main-content' className='pf-main'>
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
            <FeedbackForm userEmail={userEmail} isAdmin={userIsAdmin} />
          </div>

          <div className='right-col'>
            <div className='pf-card status-card'>
              <div className='status-head'>
                <div className='status-pill'>DPT_LOG_v3.0</div>
                {userEmail ? <ProfileMenu email={userEmail} /> : null}
              </div>
              <h2 className='status-title'>
                MISSION
                <br />
                STATUS
              </h2>
              <div className='status-copy'>
                <p>Reports submitted through this terminal are routed to the Preflight engineering core.</p>
                <div className='status-note'>
                  <p>[ SYSTEM_ADVISORY ]</p>
                  <p>Feedback intake and roadmap delivery are now in one live mission pipeline.</p>
                </div>
              </div>
              <Link href='/roadmap' className='pf-button invert'>
                <span>OPEN_PUBLIC_ROADMAP</span>
                <span>→</span>
              </Link>
              {userEmail ? null : (
                <div className='home-auth-links'>
                  <Link href='/auth/login'>Login</Link>
                  <span>·</span>
                  <Link href='/auth/signup'>Register</Link>
                </div>
              )}
              <div className='status-board-shell'>
                <p className='panel-subtitle'>LIVE_FEEDBACK</p>
                <FeedbackBoard embedded isAdmin={userIsAdmin} />
                <div className='pipeline-divider' />
                <p className='panel-subtitle'>DELIVERY_ROADMAP</p>
                <RoadmapBoard embedded />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
