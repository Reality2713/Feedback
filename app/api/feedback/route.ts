import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { parseSort, sortFeedback } from '@/lib/feedback';

type FeedbackPayload = {
  type?: string;
  priority?: string;
  subject?: string;
  description?: string;
  email?: string;
};

function widgetEmail(email: string) {
  return email.replace('@', '+widget@');
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FeedbackPayload | null;
  if (!body?.subject || !body?.description || !body?.email) {
    return NextResponse.json({ error: 'subject, description and email are required.' }, { status: 400 });
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

  const wEmail = widgetEmail(body.email);
  let userId: string | null = null;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', wEmail)
    .single();

  if (existingProfile?.id) {
    userId = existingProfile.id;
  } else {
    const fullName = body.email.split('@')[0];
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

  const content = [`Type: ${body.type || 'FEATURE_REQUEST'}`, `Priority: ${body.priority || 'MEDIUM'}`, '', body.description].join('\n');

  const { error: insertError } = await supabase.from('feedback').insert({
    title: body.subject,
    description: content,
    project_id: project.id,
    user_id: userId,
    status: 'open',
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(request: Request) {
  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';
  const requestUrl = new URL(request.url);
  const sort = parseSort(requestUrl.searchParams.get('sort'));

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
    .from('feedback')
    .select('id, created_at, title, description, status, upvotes')
    .eq('project_id', project.id);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to load feedback.' }, { status: 500 });
  }

  const rows = data.map((row) => ({ ...row, upvotes: Number(row.upvotes || 0) }));
  return NextResponse.json({ items: sortFeedback(rows, sort), sort }, { status: 200 });
}
