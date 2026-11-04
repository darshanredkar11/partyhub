# PartyHub

Private, guest-first party planning PWA for India and the UK.

## Architecture
- Next.js App Router + TypeScript
- Supabase Auth (email magic links), PostgreSQL, RLS, private Storage, Realtime
- Browser-native Web Crypto API for selective client-side encryption
- Vercel hosting
- No custom always-on application server

## Security baseline
- Never expose Supabase service-role credentials in the browser.
- Enable RLS on every table in exposed schemas.
- Use least-privilege grants and deny-by-default policies.
- Keep party media in private buckets.
- Treat invitation tokens as bearer secrets; store only token hashes.
- Keep payment-provider secrets and webhook verification in trusted managed functions.
- Selective encryption is not a claim of end-to-end encryption.

## Initial implementation scope
1. Supabase schema, constraints, helper functions and RLS.
2. Next.js PWA shell and Supabase browser client.
3. Email magic-link authentication.
4. Party dashboard and guest-first invitation landing page.
5. Private gallery foundation.
6. Security and database tests.

## Local development
1. Install Node.js 20.11+.
2. Copy .env.example to .env.local and fill in the Supabase project URL and anon/publishable key. These are public client credentials, not service-role secrets.
3. Run npm install.
4. Apply migrations with the Supabase CLI: supabase db reset. The initial migration creates the private party-media bucket and RLS policies.
5. Run npm run dev.

Do not commit secrets or real guest data.
## Sign-in and WhatsApp
The first release uses Supabase email magic links. WhatsApp shares invitation links only; it does not deliver Supabase Auth magic links. Email is the fallback and recovery route.

## Privacy and caching
The service worker caches only static shell assets and the web manifest. It does not cache Supabase responses, auth routes, party details, RSVPs, or decrypted media. The gallery bucket is private and membership-gated.
