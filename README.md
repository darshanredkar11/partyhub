# PartyHub

Private, guest-first party planning PWA for India and the UK.

## Draft 1 functionality

- Host sign-in with Supabase email magic links (PKCE).
- Create and manage celebrations with local timezone, date, event schedule, arrival window and INR/GBP currency.
- Party data and RSVP responses persist in Supabase Postgres and are available across devices.
- Create high-entropy invitation links; only token hashes are stored in the database.
- Guests RSVP without creating an account, including attendance, guest count and dietary preference.
- A guest can update their response by submitting the same name through the same invitation.
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

- `npm run typecheck`
- `npm run test:e2e`
- `npm run build`

The E2E suite checks the auth entry point, invalid invitation handling and mobile layout. A real cross-device integration run requires a configured Supabase project and must test host creation, invite creation, guest RSVP, update-by-name, RLS isolation, expiry and revocation.

## Not yet in Draft 1

Private gallery upload UI, co-host management, awards/voting, payments, playlists, games and party recap are later feature slices. The database foundation includes private media metadata and storage policies, but there is no gallery UI yet.

Before public launch, add rate limiting/CAPTCHA to public invite RPCs, audit logging, retention/deletion controls and security review. The public guest RPCs are currently protected by high-entropy invitation tokens, expiration, revocation and bounded uses, but do not have per-IP throttling.
