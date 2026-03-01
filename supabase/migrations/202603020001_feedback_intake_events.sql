create table if not exists public.feedback_intake_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects(id) on delete cascade,
  feedback_id uuid references public.feedback(id) on delete set null,
  source text not null default 'web',
  reference_url text,
  reporter_email text,
  event_type text not null default 'submission',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists feedback_intake_events_project_created_idx
  on public.feedback_intake_events(project_id, created_at desc);

create index if not exists feedback_intake_events_feedback_idx
  on public.feedback_intake_events(feedback_id);
