# Preflight Rewrite (Next.js)

This app is the new app-first rewrite bootstrap for Preflight roadmap/feedback.

## Scope in this first bootstrap

- Port visual language from Astro roadmap page.
- Create a clean Next.js app-router foundation.
- Add a working feedback submit endpoint to Supabase.

## Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PREFLIGHT_PROJECT_SLUG` (optional, defaults to `preflight`)

## Next milestones

1. Auth (magic link + OAuth) with protected dashboard routes.
2. Feedback list with sorting + voting.
3. Cloudflare R2 attachment pipeline (signed uploads + metadata).
4. Kanban and roadmap modules.
