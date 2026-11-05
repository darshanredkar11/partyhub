# PartyHub

Private, guest-first party planning PWA for India and the UK.

## Draft 1 functionality

- Host sign-in with Supabase email magic links (PKCE).
- Create and view celebrations with validated local date/time, arrival window, IANA timezone and INR/GBP currency.
- Party data and RSVP responses persist in Supabase Postgres and are available across devices.
- Create high-entropy invitation links; only token hashes are stored in the database.
- Guests RSVP without creating an account, including attendance, guest count and dietary preference.
- A guest can update their response from the same browser/device using a private, per-response edit token. Only its SHA-256 hash is stored in the database; knowing the guest name and invite URL is not sufficient to change another person’s RSVP.
- Host dashboard shows RSVP totals and individual guest responses.
- WhatsApp sharing and copy-link support.
- Responsive PWA shell; private/authenticated content must not be cached by the service worker.

## Stack

- Next.js App Router + TypeScript, static export.
- Supabase Auth, PostgreSQL, RLS and private Storage foundation.

## Run locally

1. Use Node.js 20.11+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Run `npm run dev`.

## Supabase setup

Apply migrations in timestamp order:

- `20261104000100_partyhub_foundation.sql`
- `20261104000200_partyhub_invites_rsvp.sql`

Configure Supabase Authentication URL Configuration with the deployed site URL and redirect URL `https://YOUR_DOMAIN/` (and local `http://localhost:3000/` for development). Enable email magic-link sign-in.

The browser only uses the Supabase publishable/anon key. Never put a service-role key in `.env.local`, client code, or a public deployment variable.

## Verification

Run:

- `npm install`
- `npm audit --audit-level=low`
- `npm run typecheck`
- `npm run test:e2e`
- `supabase start && supabase db reset && supabase test db`

Playwright builds and serves the production static export, then tests the host and guest journeys, validation, invitation and RSVP errors, update-token behavior, mobile layout, manifest assets, clipboard actions and offline service-worker behavior. Supabase pgTAP tests apply every migration to a fresh local database and verify RLS isolation, RPC grants, SECURITY DEFINER search paths, host/timezone integrity, invite limits, expiry/revocation and the per-response RSVP secret. The E2E Supabase HTTP boundary is mocked; live magic-link delivery and a deployed cross-device provider test are not claimed as passed.

## Not yet in Draft 1

Private gallery upload UI, co-host management, awards/voting, payments, playlists, games and party recap are later feature slices. The database foundation includes private media metadata and storage policies, but there is no gallery UI yet.

Before public launch, add a trusted edge/server-side rate limit or CAPTCHA for public invite RPCs, audit logging, retention/deletion controls and an independent security review. The guest RPCs validate high-entropy invitation tokens, expiration, revocation, bounded uses and a per-response edit secret; direct browser-to-database calls do not provide reliable per-IP throttling.

## GitHub Actions database deployment

The workflow `.github/workflows/supabase-migrations.yml` previews and applies checked-in migrations using the Supabase CLI. It is available from GitHub Actions as **PartyHub database migrations** and also runs on migration changes pushed to `main` or `initial-partyhub-draft`.

Configure these two repository Actions secrets (Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with access to the linked project.
- `SUPABASE_DB_PASSWORD`: the database password for project `mqzjziaxbbozytumwsca`.

The project ref is pinned in `supabase/config.toml` and the workflow to prevent accidental deployment to another project. Never commit either secret. The workflow runs a migration dry-run before applying migrations and prints the resulting migration history.
