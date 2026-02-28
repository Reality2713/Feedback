import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeStatus, parseSort, parseStatusFilter, sortFeedback } from '@/lib/feedback';
import { buildFeedbackContent, parseFeedbackContent } from '@/lib/feedback-content';

type FeedbackPayload = {
  type?: string;
  priority?: string;
  subject?: string;
  description?: string;
  email?: string;
  attachments?: string[];
};

function widgetEmail(email: string) {
  return email.replace('@', '+widget@');
}

async function getAuthenticatedEmail() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const cookieStore = cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // No-op in contexts where response cookie mutation is unavailable.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // No-op in contexts where response cookie mutation is unavailable.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
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
    body.description,
    attachments
  );

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
  const statusFilter = parseStatusFilter(requestUrl.searchParams.get('status'));

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
      attachments: parsed.attachments,
    };
  });
  return NextResponse.json({ items: sortFeedback(rows, sort), sort }, { status: 200 });
}
