import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeProfileEmail } from '@/lib/feedback-notifications';

export type NotificationEvent = 'status' | 'comment' | 'resolution' | 'archive';

export type NotificationPreferences = {
  status_updates: boolean;
  comment_updates: boolean;
  resolution_updates: boolean;
  archived_updates: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  status_updates: true,
  comment_updates: true,
  resolution_updates: true,
  archived_updates: true,
};

function eventColumn(event: NotificationEvent) {
  if (event === 'status') return 'status_updates';
  if (event === 'comment') return 'comment_updates';
  if (event === 'resolution') return 'resolution_updates';
  return 'archived_updates';
}

export async function getNotificationPreferences(feedbackId: string, email: string) {
  const normalized = normalizeProfileEmail(email);
  if (!normalized) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('feedback_notification_preferences')
    .select('status_updates, comment_updates, resolution_updates, archived_updates')
    .eq('feedback_id', feedbackId)
    .eq('email', normalized)
    .maybeSingle();

  if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  return {
    status_updates: data.status_updates ?? true,
    comment_updates: data.comment_updates ?? true,
    resolution_updates: data.resolution_updates ?? true,
    archived_updates: data.archived_updates ?? true,
  };
}

export async function upsertNotificationPreferences(
  feedbackId: string,
  email: string,
  preferences: Partial<NotificationPreferences>
) {
  const normalized = normalizeProfileEmail(email);
  if (!normalized) throw new Error('email is required');

  const supabase = createSupabaseAdminClient();
  const payload = {
    feedback_id: feedbackId,
    email: normalized,
    status_updates: preferences.status_updates ?? true,
    comment_updates: preferences.comment_updates ?? true,
    resolution_updates: preferences.resolution_updates ?? true,
    archived_updates: preferences.archived_updates ?? true,
  };

  const { data, error } = await supabase
    .from('feedback_notification_preferences')
    .upsert(payload, { onConflict: 'feedback_id,email' })
    .select('status_updates, comment_updates, resolution_updates, archived_updates')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save notification preferences.');
  }

  return {
    status_updates: data.status_updates ?? true,
    comment_updates: data.comment_updates ?? true,
    resolution_updates: data.resolution_updates ?? true,
    archived_updates: data.archived_updates ?? true,
  };
}

export async function shouldNotify(feedbackId: string, email: string, event: NotificationEvent) {
  const prefs = await getNotificationPreferences(feedbackId, email);
  return prefs[eventColumn(event)];
}
