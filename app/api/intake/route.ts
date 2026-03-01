import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { isAdminEmail } from '@/lib/admin';

type IntakePayload = {
  source?: string;
  reference_url?: string;
  reporter_email?: string;
  title?: string;
  type?: string;
  priority?: string;
  notes?: string;
};

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

export async function POST(request: Request) {
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  if (!isAdminEmail(authEmail)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as IntakePayload | null;
  const source = String(body?.source || 'other').trim().toLowerCase();
  const referenceUrl = String(body?.reference_url || '').trim();
  const reporterEmail = String(body?.reporter_email || '').trim().toLowerCase();
  const title = String(body?.title || '').trim();
  const notes = String(body?.notes || '').trim();
  const type = String(body?.type || 'FEATURE_REQUEST').trim();
  const priority = String(body?.priority || 'MEDIUM').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required.' }, { status: 400 });
  }
  if (referenceUrl && !/^https?:\/\//i.test(referenceUrl)) {
    return NextResponse.json({ error: 'reference_url must start with http:// or https://.' }, { status: 400 });
  }

  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';
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

  const { data: created, error } = await supabase
    .from('feedback_intake_events')
    .insert({
      project_id: project.id,
      source,
      reference_url: referenceUrl || null,
      reporter_email: reporterEmail || null,
      event_type: 'manual_capture',
      payload: {
        title,
        notes,
        type,
        priority,
        captured_by: authEmail || null,
      },
    })
    .select('id, created_at')
    .single();

  if (error || !created) {
    if (String(error?.message || '').toLowerCase().includes('feedback_intake_events')) {
      return NextResponse.json(
        { error: 'Intake schema missing. Run supabase/migrations/202603020001_feedback_intake_events.sql first.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error?.message || 'Failed to create intake event.' }, { status: 500 });
  }

  return NextResponse.json({ item: created }, { status: 200 });
}
