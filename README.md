# PartyHub

A guest-first, inclusive party planning PWA for private celebrations in India and the UK.

## Product scope — first release
- Host accounts use email magic-link sign-in plus mandatory verified mobile number onboarding (E.164).
- Guest RSVP is link-based; guests do not need an account or app installation.
- Hosts create parties and share reusable invitation links through WhatsApp.
- Party rooms include Secret Missions, Party Bingo, Icebreaker Roulette, passport stamps, anonymous awards and a member-only photo gallery.
- Party activity feed keeps the host and members in the loop.
- Optional pronouns and chosen display names; pronouns are private by default.
- LGBTQ+ inclusive language and optional games. No gender or orientation disclosure is required.
- Monetisation, subscriptions, ads and payment integrations are deliberately deferred.

## Architecture
- Next.js App Router + TypeScript
- Supabase Auth, PostgreSQL, RLS, private Storage and Realtime-ready schema
- Browser-native Web Crypto API for selective client-side encryption
- Deployable on Supabase Cloud or self-hosted Supabase Community Edition
- No separately managed always-on application backend

## Security baseline
- Never expose Supabase service-role credentials in the browser.
- Enable RLS on every table in exposed schemas.
- Keep verified phone numbers and email addresses private; authenticated clients do not have SELECT permission on the phone column.
- Keep party media in private buckets; only accepted members can access signed media URLs.
- Treat invitation tokens as bearer secrets; store only SHA-256 hashes.
- Secret mission assignments are visible only to the player and party admins.
- Award vote identities are not selectable by clients; aggregate results are exposed through a database function.
- Selective encryption is not a claim of end-to-end encryption.

## Local development
1. Install Node.js 20.11+ and Docker.
2. Copy .env.example to .env.local and set the Supabase project URL and publishable/anon key. These are public client credentials, not service-role secrets.
3. Run `npm install`.
4. Start local Supabase with `npx supabase start`.
5. Apply migrations with `npx supabase db reset`.
6. Run `npm run dev`.

## Auth provider setup
- Enable Email OTP / magic-link authentication in Supabase Auth.
- Enable Phone authentication and configure an SMS provider (for example Twilio or another supported provider) in Supabase Auth.
- Configure the app URL and `/auth/callback` redirect URL.
- Phone verification uses Supabase's `updateUser({ phone })` followed by `verifyOtp({ type: 'phone_change' })`.
- Email sign-in alone is not enough to access the host dashboard; a verified mobile number is required.
- Guests who RSVP through an invitation link are not required to authenticate or provide a phone number.

## PWA and privacy
The service worker caches only static shell assets and the web manifest. It does not cache Supabase responses, auth routes, party details, RSVPs, or decrypted media. The gallery bucket is private and membership-gated.

## Current limitations
This is the first functional feature pass, not yet a production certification. Run typecheck, lint, build, database reset and RLS tests against a real Supabase instance before launch. SMS delivery needs a configured provider and may incur provider charges. Rate limiting, abuse reporting, content moderation, photo retention controls and operational backups must be completed before public scale.
