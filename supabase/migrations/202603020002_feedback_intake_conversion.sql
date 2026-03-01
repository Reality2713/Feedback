alter table public.feedback_intake_events
  add column if not exists dedupe_key text;

alter table public.feedback_intake_events
  add column if not exists converted_at timestamptz;

alter table public.feedback_intake_events
  add column if not exists converted_by text;

create index if not exists feedback_intake_events_dedupe_idx
  on public.feedback_intake_events(dedupe_key);
