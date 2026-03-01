import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { isAdminEmail } from '@/lib/admin';

export async function GET(request: Request) {
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  if (!isAdminEmail(authEmail)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';
  const requestUrl = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get('limit') || '30')));

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server misconfigured' }, { status: 500 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', projectSlug)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Target project was not found.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('feedback_intake_events')
    .select('id, created_at, source, reference_url, reporter_email, event_type, payload, feedback_id')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (String(error.message).toLowerCase().includes('feedback_intake_events')) {
      return NextResponse.json(
        { error: 'Intake schema missing. Run supabase/migrations/202603020001_feedback_intake_events.sql first.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] }, { status: 200 });
}
