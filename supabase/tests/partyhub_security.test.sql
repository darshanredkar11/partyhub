begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

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

select * from finish();
rollback;
