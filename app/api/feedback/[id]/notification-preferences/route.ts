import { NextResponse } from 'next/server';
import { getAuthenticatedEmail } from '@/lib/auth-email';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  upsertNotificationPreferences,
} from '@/lib/notification-preferences';
import { normalizeProfileEmail } from '@/lib/feedback-notifications';

type PreferencePayload = {
  email?: string;
  status_updates?: boolean;
  comment_updates?: boolean;
  resolution_updates?: boolean;
  archived_updates?: boolean;
};

function effectiveEmail(authEmail: string | null, explicitEmail: string | null) {
  const email = (authEmail || explicitEmail || '').trim().toLowerCase();
  return normalizeProfileEmail(email);
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  const requestUrl = new URL(request.url);
  const emailParam = requestUrl.searchParams.get('email');
  const email = effectiveEmail(authEmail, emailParam);
  if (!email) {
    return NextResponse.json({ preferences: DEFAULT_NOTIFICATION_PREFERENCES }, { status: 200 });
  }

  try {
    const preferences = await getNotificationPreferences(context.params.id, email);
    return NextResponse.json({ email, preferences }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load preferences.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const body = (await request.json().catch(() => null)) as PreferencePayload | null;
  const authEmail = await getAuthenticatedEmail().catch(() => null);
  const email = effectiveEmail(authEmail, body?.email ? String(body.email) : null);
  if (!email) {
    return NextResponse.json({ error: 'email is required when unauthenticated.' }, { status: 400 });
  }

  try {
    const preferences = await upsertNotificationPreferences(context.params.id, email, {
      status_updates: Boolean(body?.status_updates),
      comment_updates: Boolean(body?.comment_updates),
      resolution_updates: Boolean(body?.resolution_updates),
      archived_updates: Boolean(body?.archived_updates),
    });
    return NextResponse.json({ email, preferences }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save preferences.' }, { status: 500 });
  }
}
