# Phone verification setup

PartyHub uses email magic links for account authentication and requires a verified mobile number before a user can access the host dashboard.

1. In Supabase Dashboard → Authentication → Providers, enable Email and Phone.
2. Configure an SMS provider and its credentials. Do not put provider credentials in the browser or repository.
3. Enable phone-change OTP verification.
4. Configure the production Site URL and the exact `/auth/callback` redirect.
5. Test with a verified test number before enabling general signups.

The app sends the phone number to Supabase Auth using `updateUser({ phone })`, then verifies the returned OTP using `verifyOtp({ phone, token, type: 'phone_change' })`. The database trigger copies the verified E.164 number into the private profile record. Authenticated clients have no SELECT permission on `profiles.phone_e164`; phone numbers are not exposed to other party members.

The country selector captures a phone calling code and stores its ISO country code separately. The number is normalized to E.164 before being sent to Supabase.

Guest RSVP is intentionally different: guests can respond through a bearer invitation link without creating an account or sharing a phone number.
