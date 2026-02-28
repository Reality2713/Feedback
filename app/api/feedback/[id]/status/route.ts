import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { normalizeStatus } from '@/lib/feedback';

type StatusPayload = {
  status?: string;
};

const ALLOWED = new Set(['open', 'planned', 'in_progress', 'shipped']);

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const body = (await request.json().catch(() => null)) as StatusPayload | null;
  const nextStatus = normalizeStatus(body?.status);
  if (!ALLOWED.has(nextStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  try {
    const supabaseSession = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseSession.auth.getUser();
    if (!isAdminEmail(user?.email)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
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

  const { error: updateError } = await supabase
    .from('feedback')
    .update({ status: nextStatus })
    .eq('id', context.params.id)
    .eq('project_id', project.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: nextStatus }, { status: 200 });
}
