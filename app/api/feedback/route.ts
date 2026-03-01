import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isAdminEmail } from '@/lib/admin';
import { normalizeStatus, parseSort, parseStatusFilter, sortFeedback } from '@/lib/feedback';
import { buildFeedbackContent, parseFeedbackContent } from '@/lib/feedback-content';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { buildIntakeDedupeKey } from '@/lib/intake';

type FeedbackPayload = {
  type?: string;
  priority?: string;
  source?: string;
  reference?: string;
  subject?: string;
  description?: string;
  email?: string;
  attachments?: string[];
};

function widgetEmail(email: string) {
  return email.replace('@', '+widget@');
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FeedbackPayload | null;
  if (!body?.subject || !body?.description) {
    return NextResponse.json({ error: 'subject and description are required.' }, { status: 400 });
  }
  const attachments = (body.attachments || [])
    .map((url) => String(url || '').trim())
    .filter((url) => url.startsWith('http://') || url.startsWith('https://'))
    .slice(0, 4);

  const authEmail = await getAuthenticatedEmail().catch(() => null);
  const isAdmin = isAdminEmail(authEmail);
  const submittedEmail = (body.email || '').trim();
  const effectiveEmail = authEmail || submittedEmail;
  if (!effectiveEmail) {
    return NextResponse.json({ error: 'email is required when unauthenticated.' }, { status: 400 });
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

  const wEmail = widgetEmail(effectiveEmail);
  let userId: string | null = null;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', wEmail)
    .single();

  if (existingProfile?.id) {
    userId = existingProfile.id;
  } else {
    const fullName = effectiveEmail.split('@')[0];
    const { data: createdProfile, error: createProfileError } = await supabase
      .from('profiles')
      .insert({ email: wEmail, full_name: fullName })
      .select('id')
      .single();

    if (createProfileError || !createdProfile) {
      return NextResponse.json({ error: 'Unable to create widget profile.' }, { status: 500 });
    }

    userId = createdProfile.id;
  }

  const content = buildFeedbackContent(
    body.type || 'FEATURE_REQUEST',
    body.priority || 'MEDIUM',
    isAdmin ? body.source || 'web' : 'web',
    isAdmin ? body.reference || '' : '',
    body.description,
    attachments
  );

  const { data: createdFeedback, error: insertError } = await supabase
    .from('feedback')
    .insert({
      title: body.subject,
      description: content,
      project_id: project.id,
      user_id: userId,
      status: 'open',
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Intake trail is best-effort and should not block user submissions.
  void supabase.from('feedback_intake_events').insert({
    project_id: project.id,
    feedback_id: createdFeedback?.id || null,
    source: isAdmin ? body.source || 'web' : 'web',
    reference_url: isAdmin ? body.reference || null : null,
    reporter_email: effectiveEmail.toLowerCase(),
    dedupe_key: buildIntakeDedupeKey({
      source: isAdmin ? body.source || 'web' : 'web',
      reporterEmail: effectiveEmail.toLowerCase(),
      title: body.subject,
    }),
    event_type: 'submission',
    payload: {
      type: body.type || 'FEATURE_REQUEST',
      priority: body.priority || 'MEDIUM',
      attachments_count: attachments.length,
      title: body.subject,
      has_reference: Boolean(body.reference),
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(request: Request) {
  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';
  const requestUrl = new URL(request.url);
  const sort = parseSort(requestUrl.searchParams.get('sort'));
  const statusFilter = parseStatusFilter(requestUrl.searchParams.get('status'));
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  const isAdmin = isAdminEmail(authEmail);

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

  let query = supabase
    .from('feedback')
    .select('id, created_at, title, description, status, upvotes')
    .eq('project_id', project.id);

  if (statusFilter.length > 0) {
    query = query.in('status', statusFilter);
  }

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to load feedback.' }, { status: 500 });
  }

  const rows = data.map((row) => {
    const parsed = parseFeedbackContent(row.description || '');
    return {
      ...row,
      upvotes: Number(row.upvotes || 0),
      status: normalizeStatus(row.status),
      description: parsed.body || row.description,
      preview: parsed.preview,
      type: parsed.type,
      priority: parsed.priority,
      source: isAdmin ? parsed.source : undefined,
      reference: isAdmin ? parsed.reference : undefined,
      attachments: parsed.attachments,
    };
  });
  return NextResponse.json({ items: sortFeedback(rows, sort), sort }, { status: 200 });
}
