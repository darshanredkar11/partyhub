# PartyHub
Private, guest-first party planning PWA for India and the UK.

## First draft
The UI includes a browser-local demo flow: create a celebration, copy its invite URL, open the guest RSVP page, submit attendance and food preference, and see RSVP counts on the dashboard.

**Demo data is stored only in the browser that created it.** It is not synced across devices and invite links work only in that same browser profile. Do not use demo mode for real guest lists or sensitive information.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth (email magic links), PostgreSQL and RLS
- Static export PWA shell

## Run locally
1. Install Node.js 20.11+.
2. Run npm install.
3. Copy .env.example to .env.local (optional for demo mode).
4. Run npm run dev.

## Supabase setup
Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Apply the migration in supabase/migrations with the Supabase CLI. Configure Authentication URL Configuration with your deployed site URL and redirect URL https://YOUR_DOMAIN/. The magic-link flow uses PKCE and returns to the app root.

The initial migration is a foundation, not a production security sign-off. Add rate limiting/CAPTCHA, audit logging, private media policies, retention/deletion controls and database integration tests before public launch.

## Build
Run npm run typecheck and npm run build. The repository uses Next.js static export. Avoid server route handlers or SSR-only Supabase code unless hosting architecture is deliberately changed.
