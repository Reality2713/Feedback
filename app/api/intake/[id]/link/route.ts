import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import { isAdminEmail } from '@/lib/admin';

type LinkPayload = {
  feedback_id?: string;
};

export async function POST(request: Request, context: { params: { id: string } }) {
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  if (!isAdminEmail(authEmail)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as LinkPayload | null;
  const feedbackId = String(body?.feedback_id || '').trim();
  if (!feedbackId) {
    return NextResponse.json({ error: 'feedback_id is required.' }, { status: 400 });
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

  const { data: targetFeedback, error: targetFeedbackError } = await supabase
    .from('feedback')
    .select('id')
    .eq('id', feedbackId)
    .eq('project_id', project.id)
    .single();
  if (targetFeedbackError || !targetFeedback) {
    return NextResponse.json({ error: 'feedback_id not found in project.' }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('feedback_intake_events')
    .update({
      feedback_id: feedbackId,
      converted_at: new Date().toISOString(),
      converted_by: authEmail,
    })
    .eq('id', context.params.id)
    .eq('project_id', project.id)
    .select('id, feedback_id, converted_at, converted_by')
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || 'Failed to link intake event.' }, { status: 500 });
  }

  return NextResponse.json({ item: updated }, { status: 200 });
}
