create table if not exists public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_email text not null,
  author_role text not null default 'user',
  body text not null
);

create index if not exists feedback_comments_feedback_id_idx on public.feedback_comments(feedback_id);
create index if not exists feedback_comments_created_at_idx on public.feedback_comments(created_at desc);

alter table public.feedback_comments
  drop constraint if exists feedback_comments_author_role_check;

alter table public.feedback_comments
  add constraint feedback_comments_author_role_check
  check (author_role in ('user', 'admin', 'system'));
