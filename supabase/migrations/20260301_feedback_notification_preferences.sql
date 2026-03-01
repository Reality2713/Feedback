create table if not exists public.feedback_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  email text not null,
  status_updates boolean not null default true,
  comment_updates boolean not null default true,
  resolution_updates boolean not null default true,
  archived_updates boolean not null default true
);

create unique index if not exists feedback_notification_preferences_unique
  on public.feedback_notification_preferences(feedback_id, email);

create index if not exists feedback_notification_preferences_feedback_idx
  on public.feedback_notification_preferences(feedback_id);

create index if not exists feedback_notification_preferences_email_idx
  on public.feedback_notification_preferences(email);
