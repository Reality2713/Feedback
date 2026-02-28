import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const DEFAULT_BUCKET = 'feedback-attachments';
const DEFAULT_MAX_SIZE_MB = 8;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required.' }, { status: 400 });
  }

  const maxSizeMb = Number(process.env.MAX_ATTACHMENT_MB || DEFAULT_MAX_SIZE_MB);
  const maxSizeBytes = Math.max(1, maxSizeMb) * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return NextResponse.json({ error: `file exceeds ${maxSizeMb}MB limit.` }, { status: 413 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'only image uploads are allowed.' }, { status: 415 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const projectSlug = process.env.PREFLIGHT_PROJECT_SLUG || 'preflight';
  const filename = sanitizeFilename(file.name || 'attachment');
  const objectPath = `${projectSlug}/${Date.now()}-${crypto.randomUUID()}-${filename}`;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server misconfigured' }, { status: 500 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json(
    {
      url: publicData.publicUrl,
      path: objectPath,
      size: file.size,
      contentType: file.type,
      bucket,
    },
    { status: 200 }
  );
}
