import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: 'Server is not configured for Supabase writes.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);

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
