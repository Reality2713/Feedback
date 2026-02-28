import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { isAdminEmail } from '@/lib/admin';
import { normalizeProfileEmail, notifyFeedbackCommentAdded } from '@/lib/feedback-notifications';

type CommentPayload = {
  body?: string;
  email?: string;
};

function widgetEmail(email: string) {
  return email.replace('@', '+widget@');
}

function isSchemaMissingError(message: string | undefined) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('relation "feedback_comments" does not exist') ||
    text.includes("table 'feedback_comments'") ||
    text.includes('column "user_id" does not exist') ||
    text.includes('column "author_email" does not exist') ||
    text.includes('column "author_role" does not exist') ||
    text.includes('column "body" does not exist')
  );
}

function normalizeRole(email: string | null | undefined) {
  return isAdminEmail(email) ? 'admin' : 'user';
}

async function resolveProfileId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  preferWidgetAlias: boolean
) {
  const normalized = email.trim().toLowerCase();
  const candidates = [normalized, widgetEmail(normalized)];

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', candidates)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const profileEmail = preferWidgetAlias ? widgetEmail(normalized) : normalized;
  const fullName = normalized.split('@')[0] || 'operator';
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ email: profileEmail, full_name: fullName })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error('Unable to resolve profile for comment author.');
  }

  return created.id;
}

export async function GET(_request: Request, context: { params: { id: string } }) {
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

  const { data: feedbackRow, error: feedbackError } = await supabase
    .from('feedback')
    .select('id')
    .eq('id', context.params.id)
    .eq('project_id', project.id)
    .single();
  if (feedbackError || !feedbackRow) {
    return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('feedback_comments')
    .select('id, created_at, author_email, author_role, body')
    .eq('feedback_id', context.params.id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error.message)) {
      return NextResponse.json(
        { error: 'Comments schema missing. Run supabase/migrations/20260228_feedback_comments.sql first.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] }, { status: 200 });
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const body = (await request.json().catch(() => null)) as CommentPayload | null;
  const commentBody = String(body?.body || '').trim();
  if (!commentBody) {
    return NextResponse.json({ error: 'comment body is required.' }, { status: 400 });
  }
  if (commentBody.length > 5000) {
    return NextResponse.json({ error: 'comment body exceeds 5000 characters.' }, { status: 400 });
  }

  const authEmail = await getAuthenticatedEmail().catch(() => null);
  const submittedEmail = String(body?.email || '').trim().toLowerCase();
  const actorEmail = (authEmail || submittedEmail || '').trim().toLowerCase();
  if (!actorEmail) {
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

  const { data: feedbackRow, error: feedbackError } = await supabase
    .from('feedback')
    .select('id, title, user_id')
    .eq('id', context.params.id)
    .eq('project_id', project.id)
    .single();
  if (feedbackError || !feedbackRow) {
    return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  let authorProfileId: string;
  try {
    authorProfileId = await resolveProfileId(supabase, actorEmail, !authEmail);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unable to resolve comment author.' }, { status: 500 });
  }

  const { data: created, error: commentError } = await supabase
    .from('feedback_comments')
    .insert({
      feedback_id: context.params.id,
      user_id: authorProfileId,
      author_email: actorEmail,
      author_role: normalizeRole(authEmail || submittedEmail),
      body: commentBody,
    })
    .select('id, created_at, author_email, author_role, body')
    .single();

  if (commentError || !created) {
    if (isSchemaMissingError(commentError?.message)) {
      return NextResponse.json(
        { error: 'Comments schema missing. Run supabase/migrations/20260228_feedback_comments.sql first.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: commentError?.message || 'Failed to create comment.' }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', feedbackRow.user_id)
    .single();
  const recipient = normalizeProfileEmail(profile?.email);
  if (recipient && recipient !== normalizeProfileEmail(actorEmail)) {
    void notifyFeedbackCommentAdded({
      toEmail: recipient,
      feedbackId: feedbackRow.id,
      feedbackTitle: feedbackRow.title,
      commentBody,
      actorEmail,
    });
  }

  return NextResponse.json({ item: created }, { status: 200 });
}
