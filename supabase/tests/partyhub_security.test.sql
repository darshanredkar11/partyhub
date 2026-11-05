begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(48);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'parties', 'parties table exists');
select has_table('public', 'party_members', 'party memberships table exists');
select has_table('public', 'invitations', 'invitations table exists');
select has_table('public', 'guest_rsvps', 'guest RSVP table exists');
select has_column('public', 'guest_rsvps', 'edit_token_hash', 'RSVP edit token hash is stored');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.parties'::regclass), 'parties enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.party_members'::regclass), 'party memberships enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.invitations'::regclass), 'invitations enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.guest_rsvps'::regclass), 'guest RSVPs enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.media_assets'::regclass), 'media metadata enforces RLS');

select ok(has_function_privilege('anon', 'public.get_invitation_preview(text)', 'EXECUTE'), 'anonymous guests can preview an invitation');
select ok(not has_function_privilege('anon', 'public.create_party_invite(uuid)', 'EXECUTE'), 'anonymous users cannot mint invitations');
select ok(has_function_privilege('authenticated', 'public.create_party_invite(uuid)', 'EXECUTE'), 'authenticated hosts can call invitation creation RPC');
select ok(has_function_privilege('anon', 'public.submit_guest_rsvp(text,text,text,integer,text,text)', 'EXECUTE'), 'anonymous guests can submit an RSVP');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'submit_guest_rsvp'
    and oidvectortypes(p.proargtypes) = 'text, text, text, integer, text'
), 'legacy insecure RSVP RPC signature is removed');

select ok(exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'submit_guest_rsvp'
    and p.prosecdef and p.proconfig @> array['search_path=""']
), 'RSVP SECURITY DEFINER function pins an empty search_path');

select ok(not has_table_privilege('anon', 'public.invitations', 'SELECT'), 'anonymous users cannot read invitation token hashes');
select ok(not has_table_privilege('anon', 'public.guest_rsvps', 'SELECT'), 'anonymous users cannot enumerate guest RSVPs');
select ok(not (select public from storage.buckets where id = 'party-media'), 'party media storage bucket is private');

-- Create a real database fixture as the migration owner, then exercise the
-- public RPC under the anon role. Everything is rolled back at the end.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'partyhub-security-test@example.test', '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.parties (
  id, host_id, title, party_type, starts_at, ends_at, timezone, currency, status
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Security test party', 'house_party', now() + interval '1 day',
  now() + interval '1 day 4 hours', 'UTC', 'INR', 'published'
);

insert into public.invitations (
  id, party_id, token_hash, expires_at, max_uses, uses_count, created_by
) values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  extensions.digest(convert_to(repeat('a', 64), 'UTF8'), 'sha256'),
  now() + interval '1 day', 1, 0, '11111111-1111-4111-8111-111111111111'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '55555555-5555-4555-8555-555555555555',
  'authenticated', 'authenticated', 'partyhub-security-test-2@example.test', '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.parties (
  id, host_id, title, party_type, starts_at, ends_at, timezone, currency, status
) values (
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  'Other host party', 'dinner', now() + interval '2 days',
  now() + interval '2 days 4 hours', 'UTC', 'GBP', 'published'
);

insert into public.invitations (
  id, party_id, token_hash, expires_at, max_uses, uses_count, created_by
) values
  ('66666666-6666-4666-8666-666666666666',
   '22222222-2222-4222-8222-222222222222',
   extensions.digest(convert_to(repeat('c',64), 'UTF8'), 'sha256'),
   now() + interval '1 day', 10, 0, '11111111-1111-4111-8111-111111111111'),
  ('77777777-7777-4777-8777-777777777777',
   '22222222-2222-4222-8222-222222222222',
   extensions.digest(convert_to(repeat('d',64), 'UTF8'), 'sha256'),
   now() - interval '1 day', 10, 0, '11111111-1111-4111-8111-111111111111'),
  ('88888888-8888-4888-8888-888888888888',
   '22222222-2222-4222-8222-222222222222',
   extensions.digest(convert_to(repeat('e',64), 'UTF8'), 'sha256'),
   now() + interval '1 day', 10, 0, '11111111-1111-4111-8111-111111111111', now());

create temporary table rsvp_test_tokens(edit_token text);
grant select, insert on rsvp_test_tokens to anon;

set local role anon;

select lives_ok(
  $$insert into pg_temp.rsvp_test_tokens(edit_token)
    select (public.submit_guest_rsvp(upper(repeat('a',64)), 'Asha Guest', 'yes', 1, 'none', null))->>'edit_token'$$,
  'first guest RSVP succeeds and receives a private edit secret'
);

select is(
  (select count(*)::integer from public.get_invitation_preview(repeat('a',64))),
  1,
  'a full invitation remains previewable so existing guests can update'
);

select throws_ok(
  $$select public.submit_guest_rsvp(repeat('a',64), 'Asha Guest', 'no', 1, 'none', null)$$,
  'P0001',
  'An RSVP with this name already exists. Use the original browser or device to update it.',
  'knowing the invite and guest name cannot overwrite an existing RSVP'
);

select lives_ok(
  $$select public.submit_guest_rsvp(
    repeat('a',64), 'Asha Guest', 'no', 2, 'vegetarian',
    (select edit_token from pg_temp.rsvp_test_tokens)
  )$$,
  'the private edit secret allows the guest to update their RSVP'
);

select throws_ok(
  $$select public.submit_guest_rsvp(repeat('a',64), 'Another Guest', 'yes', 1, 'none', null)$$,
  'P0001',
  'This invitation has reached its guest limit',
  'a new guest is rejected when the invitation use limit is reached'
);


select is(
  (select count(*)::integer from public.get_invitation_preview(upper(repeat('a',64)))),
  1,
  'invitation preview normalizes token case'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',63), 'Invalid Token', 'yes', 1, 'none', null)$,
  'P0001', 'Invalid invitation', 'malformed invitation tokens are rejected'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',64), 'Invalid Response', 'attending', 1, 'none', null)$,
  'P0001', 'Invalid RSVP response', 'unsupported RSVP responses are rejected'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',64), 'Too Few', 'yes', 0, 'none', null)$,
  'P0001', 'Invalid guest count', 'guest counts below one are rejected'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',64), 'Too Many', 'yes', 21, 'none', null)$,
  'P0001', 'Invalid guest count', 'guest counts above twenty are rejected'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',64), 'Invalid Diet', 'yes', 1, 'gluten_free', null)$,
  'P0001', 'Invalid dietary preference', 'unsupported dietary preferences are rejected'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('a',64), 'Asha Guest', 'yes', 1, 'none', 'bad-edit-token')$,
  'P0001', 'Invalid RSVP edit permission', 'malformed RSVP edit tokens are rejected'
);
select is(
  (select count(*)::integer from public.get_invitation_preview(repeat('d',64))),
  0,
  'expired invitations cannot be previewed'
);
select is(
  (select count(*)::integer from public.get_invitation_preview(repeat('e',64))),
  0,
  'revoked invitations cannot be previewed'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('d',64), 'Expired Guest', 'yes', 1, 'none', null)$,
  'P0001', 'Invitation is invalid, expired, or revoked', 'expired invitations cannot accept RSVPs'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('e',64), 'Revoked Guest', 'yes', 1, 'none', null)$,
  'P0001', 'Invitation is invalid, expired, or revoked', 'revoked invitations cannot accept RSVPs'
);
select throws_ok(
  $select public.submit_guest_rsvp(repeat('c',64), 'Bad' || chr(10) || 'Name', 'yes', 1, 'none', null)$,
  '23514',
  'new row for relation "guest_rsvps" violates check constraint "guest_rsvps_display_name_no_control_chars"',
  'control characters in guest names are rejected by the database'
);

reset role;

select is(
  (select response from public.guest_rsvps
   where invitation_id = '33333333-3333-4333-8333-333333333333'
     and display_name = 'Asha Guest'),
  'no',
  'the authorised RSVP update is persisted'
);

select ok(
  (select r.edit_token_hash = extensions.digest(convert_to(t.edit_token, 'UTF8'), 'sha256')
   from public.guest_rsvps r cross join pg_temp.rsvp_test_tokens t
   where r.invitation_id = '33333333-3333-4333-8333-333333333333'
     and r.display_name = 'Asha Guest'),
  'the database stores only the SHA-256 edit-secret hash'
);


set local role authenticated;
do $claims$ begin perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true); end $claims$;

select is(
  (select count(*)::integer from public.parties where id = '22222222-2222-4222-8222-222222222222'),
  1,
  'host A can read their own party'
);
select is(
  (select count(*)::integer from public.parties where id = '44444444-4444-4444-8444-444444444444'),
  0,
  'host A cannot read host B party'
);
select lives_ok(
  $upd$update public.parties set title = 'Unauthorized update'
    where id = '44444444-4444-4444-8444-444444444444'$upd$,
  'host A cannot change another host party'
);
select is(
  (select count(*)::integer from public.guest_rsvps
   where invitation_id = '33333333-3333-4333-8333-333333333333'),
  1,
  'host A can read guest RSVPs for their party'
);
select throws_ok(
  $hostchange$update public.parties set host_id = '55555555-5555-4555-8555-555555555555'
    where id = '22222222-2222-4222-8222-222222222222'$hostchange$,
  'P0001',
  'Party host cannot be changed after creation',
  'party host identity cannot be reassigned'
);
select throws_ok(
  $timezone$update public.parties set timezone = 'Not/AReal_TimeZone'
    where id = '22222222-2222-4222-8222-222222222222'$timezone$,
  'P0001',
  'Invalid party time zone',
  'invalid time zones are rejected in the database'
);

do $claims$ begin perform set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true); end $claims$;
select is(
  (select title from public.parties where id = '44444444-4444-4444-8444-444444444444'),
  'Other host party',
  'host B party remains intact after host A update attempt'
);
select is(
  (select count(*)::integer from public.guest_rsvps
   where invitation_id = '33333333-3333-4333-8333-333333333333'),
  0,
  'host B cannot read host A guest RSVPs'
);
reset role;

select * from finish();
rollback;
