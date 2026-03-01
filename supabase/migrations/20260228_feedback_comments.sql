create table if not exists public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_email text not null,
  author_role text not null default 'user',
  visibility text not null default 'public',
  body text not null
);

alter table public.feedback_comments
  add column if not exists author_email text;

alter table public.feedback_comments
  add column if not exists author_role text not null default 'user';

alter table public.feedback_comments
  add column if not exists visibility text not null default 'public';

update public.feedback_comments
set visibility = coalesce(visibility, 'public')
where visibility is null;

alter table public.feedback_comments
  alter column visibility set default 'public';

alter table public.feedback_comments
  add column if not exists body text;

alter table public.feedback_comments
  add column if not exists content text;

update public.feedback_comments
set content = coalesce(content, body, '')
where content is null or content = '';

alter table public.feedback_comments
  alter column content set default '';

update public.feedback_comments
set body = coalesce(body, content, '')
where body is null or body = '';

alter table public.feedback_comments
  alter column body set default '';

create index if not exists feedback_comments_feedback_id_idx on public.feedback_comments(feedback_id);
create index if not exists feedback_comments_created_at_idx on public.feedback_comments(created_at desc);

alter table public.feedback_comments
  drop constraint if exists feedback_comments_author_role_check;

alter table public.feedback_comments
  add constraint feedback_comments_author_role_check
  check (author_role in ('user', 'admin', 'system'));

alter table public.feedback_comments
  drop constraint if exists feedback_comments_visibility_check;

alter table public.feedback_comments
  add constraint feedback_comments_visibility_check
  check (visibility in ('public', 'internal'));
