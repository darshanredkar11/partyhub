# PartyHub — Technical & Functional Specification
Version 1.0 | 10 November 2026 | Implementation in progress

## 1. Product objective
PartyHub uses one identity for all participation. A person registers once, then creates celebrations, attends other celebrations, responds to invitations, contributes memories and votes. Host and guest are contextual permissions, not separate account types.

## 2. Identity and roles
- Supabase Auth is the canonical identity provider. auth.users.id is the immutable identity key.
- profiles is one-to-one with the auth identity. Profile provisioning is idempotent.
- Email uniqueness is enforced by Supabase Auth. No separate host/guest login or account is introduced.
- party_members.role is scoped to a specific party. A user may host Party A and be a member of Party B.
- Hosting is a capability acquired by creating a party, not a permanent global account type.
- Public invitation RSVP and public poll participation may remain token/code based and do not create a second account.
- platform_admins is a separate platform-level allowlist keyed by auth user ID. It is not self-service.

## 3. Functional requirements
FR-01 Unified account: one Supabase Auth identity per email; same session for hosting and attending; preserve existing IDs and sessions.
FR-02 Party participation: host/member roles are party-scoped; public invitation RSVP remains available without mandatory signup.
FR-03 Admin route: /admin; anonymous users are redirected to /login; authenticated non-admin users receive access denied; dashboard supports refresh and generated-at timestamp.
FR-04 Admin metrics: total users, new users (7/30 days), active users (30-day proxy), distinct hosts/members, total/upcoming/past parties, RSVP submissions, attending guest count, polls and votes.
FR-05 Trends: daily signups and party creation for trailing 30 days; top six party types.
FR-06 Privacy: aggregate-only metrics; no raw emails, names, invitation tokens, venue details or individual votes.
FR-07 Admin controls: v1 read-only analytics; no impersonation, destructive user management or moderation actions.

## 4. Metric definitions
- Active user (30d): distinct authenticated IDs with a party created or party membership updated in the trailing 30 days. This is an activity proxy, not session-based DAU.
- New user: auth.users.created_at in the selected window.
- Host: distinct parties.host_id.
- Member: distinct party_members.user_id with role other than host.
- Attending guests: sum guest_rsvps.guest_count where response is yes.
- Upcoming/past: starts_at/ends_at compared with database now(); cancelled/deleted upcoming parties excluded.

## 5. Data model
- auth.users: canonical identity.
- profiles: one-to-one profile keyed by auth user ID.
- parties: host_id owns a celebration.
- party_members: membership and role within one party.
- platform_admins: privileged platform allowlist with no client-side write access.
- Existing invitations, guest_rsvps, party_photos, award_polls, award_poll_options and award_poll_votes remain unchanged.
- v1 analytics derive from operational tables; no duplicate event pipeline is required.

## 6. API and security
- Supabase RPC: get_platform_admin_analytics().
- Returns aggregated JSON only. Server-side database function checks auth.uid() against platform_admins on every call.
- Function uses SECURITY DEFINER only to read protected auth.users and cross-tenant aggregates; empty search_path, fully qualified relations, explicit authorization, EXECUTE revoked from PUBLIC/anon.
- platform_admins has RLS enabled; authenticated users can read only their own admin row. No client insert/update/delete grants.
- Existing party RLS remains the source of truth for party permissions.
- Never use user-editable raw_user_meta_data as an authorization claim. Never expose service-role keys to browsers.

## 7. UX requirements
- Single sign-up/sign-in entry point; remove permanent Host account vs Guest account terminology.
- Context-aware navigation: My celebrations, Invitations, Profile. Admin entry appears only for platform admins.
- Admin dashboard supports loading, error, empty and access-denied states; mobile and desktop layouts.
- Metric labels show their date windows and clarify proxy definitions.

## 8. Non-functional requirements
- Preserve existing party, invitation, RSVP, photo, map, poll, vote and guest-code flows.
- Database authorization is mandatory; client route guards are only UX.
- Aggregate metrics in one bounded RPC; trailing 30-day series and top-six categories.
- Admin dashboard failures must not impact public pages or party workflows.

## 9. Acceptance criteria
1. One email cannot create separate host/member accounts.
2. Same auth user ID can own one party and join another.
3. Existing user and party records are preserved.
4. Direct non-admin RPC calls fail with SQLSTATE 42501.
5. Anonymous RPC calls fail; no analytics are public.
6. Owner can load /admin and see KPI and trend datasets.
7. Other authenticated users cannot retrieve analytics.
8. Existing party RLS and public token/code flows continue to work.
9. Mobile admin has no horizontal overflow.

## 10. Rollout and out of scope
Rollout: provision admin allowlist; add guarded analytics RPC; add /admin dashboard; test admin/non-admin authorization; run Supabase advisors and Render build. Then consider deeper event instrumentation.
Out of scope v1: billing, moderation, admin impersonation, account merging, per-user behaviour tracking, PII exports, real-time analytics and separate host/guest auth systems.
