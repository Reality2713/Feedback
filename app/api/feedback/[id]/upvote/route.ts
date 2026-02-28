import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(_request: Request, context: { params: { id: string } }) {
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

  const { data: feedback, error: feedbackError } = await supabase
    .from('feedback')
    .select('id, upvotes')
    .eq('id', context.params.id)
    .eq('project_id', project.id)
    .single();

  if (feedbackError || !feedback) {
    return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  const nextCount = Number(feedback.upvotes || 0) + 1;
  const { error: updateError } = await supabase
    .from('feedback')
    .update({ upvotes: nextCount })
    .eq('id', context.params.id)
    .eq('project_id', project.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, upvotes: nextCount }, { status: 200 });
}

