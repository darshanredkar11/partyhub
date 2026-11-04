# WhatsApp and account sign-in

Initial release uses Supabase email magic links for account authentication. WhatsApp is used to share invitation URLs through wa.me or the browser share sheet. A WhatsApp share link is not itself an authenticated Supabase magic link.

A future WhatsApp login channel would require an approved WhatsApp Business Platform provider, a trusted server-side token issuance/delivery flow, verified callbacks, consent, expiry, replay protection, rate limits and abuse monitoring. Email remains the account sign-in and recovery fallback.
