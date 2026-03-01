# Preflight Rewrite (Next.js)

This app is the new app-first rewrite bootstrap for Preflight roadmap/feedback.

## Scope in this first bootstrap

- Port visual language from Astro roadmap page.
- Create a clean Next.js app-router foundation.
- Add a working feedback submit endpoint to Supabase.
- Add a live feedback board with sort modes and upvoting.
- Add auth flow scaffold (magic link + OAuth + callback + protected dashboard).
- Add source-channel metadata (`web`, `email`, `discord`, etc.) and optional reference URL for multi-channel triage.

## Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PREFLIGHT_PROJECT_SLUG` (optional, defaults to `preflight`)
- `SUPABASE_STORAGE_BUCKET` (optional, defaults to `feedback-attachments`)
- `MAX_ATTACHMENT_MB` (optional, defaults to `8`)
- `ADMIN_EMAILS` (optional, comma-separated list of admin emails for status controls)
- `APP_BASE_URL` (optional but recommended for email links, e.g. `https://feedback.preflight.reality2713.com`)
- `RESEND_API_KEY` (optional; enables notification emails)
- `RESEND_FROM_EMAIL` (optional; required if `RESEND_API_KEY` is set)

## Next milestones

1. Replace auth scaffold with final production UX and provider settings.
2. Rich text feedback composer + image attachments.
3. Cloudflare R2 attachment pipeline (signed uploads + metadata).
4. Kanban and roadmap modules.

## Schema migration for comments

Run this SQL in Supabase SQL Editor before using comments:

- `supabase/migrations/20260228_feedback_comments.sql`
- `supabase/migrations/20260301_feedback_notification_preferences.sql`
- `supabase/migrations/202603020001_feedback_intake_events.sql`
- `supabase/migrations/202603020002_feedback_intake_conversion.sql`
