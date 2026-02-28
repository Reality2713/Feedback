import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Missing Supabase auth environment.' }, { status: 500 });
  }

  const cookieStore = cookies();
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const origin = forwardedHost && forwardedProto ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const safeNext = next && next.startsWith('/') ? next : '/dashboard';

  if (code) {
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}

