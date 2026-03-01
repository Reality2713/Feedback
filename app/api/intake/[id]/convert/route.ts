import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { isAdminEmail } from '@/lib/admin';
import { buildFeedbackContent } from '@/lib/feedback-content';

function widgetEmail(email: string) {
  return email.replace('@', '+widget@');
}

async function resolveProfileId(supabase: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const normalized = email.trim().toLowerCase();
  const candidates = [normalized, widgetEmail(normalized)];

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', candidates)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const fullName = normalized.split('@')[0] || 'operator';
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ email: widgetEmail(normalized), full_name: fullName })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error('Unable to resolve profile for intake reporter.');
  }

  return created.id;
}

export async function POST(_request: Request, context: { params: { id: string } }) {
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  if (!isAdminEmail(authEmail)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
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

  const { data: intakeEvent, error: intakeError } = await supabase
    .from('feedback_intake_events')
    .select('id, source, reference_url, reporter_email, payload, feedback_id')
    .eq('id', context.params.id)
    .eq('project_id', project.id)
    .single();

  if (intakeError || !intakeEvent) {
    return NextResponse.json({ error: 'Intake event not found.' }, { status: 404 });
  }

  if (intakeEvent.feedback_id) {
    return NextResponse.json({ error: 'Intake event already linked.', feedback_id: intakeEvent.feedback_id }, { status: 409 });
  }

  const payload = (intakeEvent.payload || {}) as {
    title?: string;
    notes?: string;
    type?: string;
    priority?: string;
  };

  const title = String(payload.title || '').trim() || 'Imported intake event';
  const description = String(payload.notes || '').trim() || 'Imported from intake log.';
  const reporterEmail = String(intakeEvent.reporter_email || '').trim().toLowerCase();

  let userId: string | null = null;
  if (reporterEmail) {
    try {
      userId = await resolveProfileId(supabase, reporterEmail);
    } catch {
      userId = null;
    }
  }

  const content = buildFeedbackContent(
    String(payload.type || 'FEATURE_REQUEST'),
    String(payload.priority || 'MEDIUM'),
    String(intakeEvent.source || 'other'),
    String(intakeEvent.reference_url || ''),
    description,
    []
  );

  const { data: createdFeedback, error: createFeedbackError } = await supabase
    .from('feedback')
    .insert({
      title,
      description: content,
      project_id: project.id,
      user_id: userId,
      status: 'open',
    })
    .select('id')
    .single();

  if (createFeedbackError || !createdFeedback) {
    return NextResponse.json({ error: createFeedbackError?.message || 'Failed to create feedback.' }, { status: 500 });
  }

  const { error: linkError } = await supabase
    .from('feedback_intake_events')
    .update({
      feedback_id: createdFeedback.id,
      converted_at: new Date().toISOString(),
      converted_by: authEmail,
    })
    .eq('id', context.params.id)
    .eq('project_id', project.id);

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ feedback_id: createdFeedback.id }, { status: 200 });
}
