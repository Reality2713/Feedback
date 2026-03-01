alter table public.feedback_comments
  add column if not exists visibility text;

update public.feedback_comments
set visibility = coalesce(visibility, 'public')
where visibility is null;

alter table public.feedback_comments
  alter column visibility set default 'public';

alter table public.feedback_comments
  alter column visibility set not null;

alter table public.feedback_comments
  drop constraint if exists feedback_comments_visibility_check;

alter table public.feedback_comments
  add constraint feedback_comments_visibility_check
  check (visibility in ('public', 'internal'));
