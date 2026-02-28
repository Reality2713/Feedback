import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/dashboard';

  return (
    <main className='auth-page'>
      <section className='auth-shell'>
        <div className='pf-brick'>OPERATOR AUTH · REGISTER</div>
        <h1 className='hero-title'>CREATE OPERATOR</h1>
        <p className='hero-meta'>Register with magic link or use OAuth directly.</p>
        <AuthForm mode='signup' nextPath={nextPath} />
        <p className='auth-switch'>
          Already have access? <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>Login here</Link>.
        </p>
      </section>
    </main>
  );
}

