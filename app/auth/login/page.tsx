import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/dashboard';

  return (
    <main className='auth-page'>
      <section className='auth-shell'>
        <div className='pf-brick'>OPERATOR AUTH · LOGIN</div>
        <h1 className='hero-title'>MISSION ACCESS</h1>
        <p className='hero-meta'>Use magic link or OAuth to enter mission control.</p>
        <AuthForm mode='login' nextPath={nextPath} />
        <p className='auth-switch'>
          No account yet? <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}>Register here</Link>.
        </p>
      </section>
    </main>
  );
}

