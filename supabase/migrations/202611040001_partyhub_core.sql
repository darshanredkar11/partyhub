-- PartyHub core schema. All timestamps are timestamptz; event timezone is stored separately.
create extension if not exists pgcrypto with schema extensions;

create type public.party_status as enum ('draft','published','cancelled','completed');
create type public.party_role as enum ('host','cohost','guest_manager','finance_admin','gallery_moderator','guest');
create type public.member_status as enum ('invited','accepted','removed');
create type public.rsvp_status as enum ('yes','no','maybe');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone_e164 text,
  phone_country char(2),
  residence_country char(2),
  payment_country char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone_country is null or phone_country ~ '^[A-Z]{2}$'),
  check (residence_country is null or residence_country ~ '^[A-Z]{2}$'),
  check (payment_country is null or payment_country ~ '^[A-Z]{2}$')
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  party_type text not null default 'house_party',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  arrival_from timestamptz,
  arrival_until timestamptz,
  timezone text not null,
  venue_label text,
  venue_ciphertext bytea,
  venue_iv bytea,
  max_guests integer check (max_guests is null or max_guests between 1 and 10000),
  status public.party_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((arrival_from is null and arrival_until is null) or (arrival_from is not null and arrival_until is not null and arrival_until >= arrival_from))
);

create table public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  role public.party_role not null default 'guest',
  status public.member_status not null default 'invited',
  joined_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index party_members_party_user_uq on public.party_members(party_id,user_id) where user_id is not null;
create index party_members_party_status_idx on public.party_members(party_id,status);
create index party_members_user_idx on public.party_members(user_id,status);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  token_hash bytea not null unique,
  invited_name text,
  invited_email text,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  uses_count integer not null default 0 check (uses_count >= 0 and uses_count <= max_uses),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  member_id uuid not null references public.party_members(id) on delete cascade,
  response public.rsvp_status not null,
  guest_count integer not null default 1 check (guest_count between 0 and 20),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(party_id,member_id)
);

create table public.guest_preferences (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  member_id uuid not null references public.party_members(id) on delete cascade,
  dietary_type text,
  allergy_ciphertext bytea,
  allergy_iv bytea,
  notes_ciphertext bytea,
  notes_iv bytea,
  updated_at timestamptz not null default now(),
  unique(party_id,member_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  uploader_member_id uuid not null references public.party_members(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 104857600),
  encrypted boolean not null default false,
  encryption_version integer,
  encryption_iv bytea,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index media_assets_party_idx on public.media_assets(party_id,created_at desc) where deleted_at is null;

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text,
  voting_starts_at timestamptz,
  voting_ends_at timestamptz,
  reveal_at timestamptz,
  status text not null default 'draft' check (status in ('draft','open','closed','revealed')),
  created_at timestamptz not null default now(),
  check (voting_starts_at is null or voting_ends_at is null or voting_ends_at > voting_starts_at)
);
create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.awards(id) on delete cascade,
  nominee_member_id uuid not null references public.party_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(award_id,nominee_member_id)
);
-- Do not expose voter identity in ballot rows. A later transactional voting RPC will enforce one ballot/member.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.awards(id) on delete cascade,
  nominee_member_id uuid not null references public.party_members(id) on delete cascade,
  ballot_commitment bytea not null unique,
  submitted_at timestamptz not null default now()
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency in ('INR','GBP')),
  provider text check (provider in ('razorpay','stripe','manual')),
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  member_id uuid references public.party_members(id) on delete set null,
  provider_payment_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency in ('INR','GBP')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  party_id uuid references public.parties(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now()
);

create table public.user_crypto_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_key jsonb not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now()
);
create table public.party_keys (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  member_id uuid not null references public.party_members(id) on delete cascade,
  encrypted_party_key bytea not null,
  ephemeral_public_key jsonb,
  key_version integer not null default 1,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(party_id,member_id,key_version)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',''))
  on conflict(id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Security-definer membership predicates avoid recursive RLS evaluation.
create or replace function public.is_party_member(p_party_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.party_members pm
    where pm.party_id=p_party_id and pm.user_id=(select auth.uid()) and pm.status='accepted'
  );
$$;
create or replace function public.has_party_role(p_party_id uuid,p_roles public.party_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.party_members pm
    where pm.party_id=p_party_id and pm.user_id=(select auth.uid())
      and pm.status='accepted' and pm.role=any(p_roles)
  );
$$;
revoke all on function public.is_party_member(uuid) from public,anon;
revoke all on function public.has_party_role(uuid,public.party_role[]) from public,anon;
grant execute on function public.is_party_member(uuid) to authenticated;
grant execute on function public.has_party_role(uuid,public.party_role[]) to authenticated;

-- Atomic party creation also creates the host membership. No client-side role assignment.
create or replace function public.create_party(
  p_title text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,
  p_description text default null,p_party_type text default 'house_party',
  p_arrival_from timestamptz default null,p_arrival_until timestamptz default null,
  p_venue_label text default null,p_max_guests integer default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_party_id uuid; v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then raise exception 'invalid title'; end if;
  if p_ends_at <= p_starts_at then raise exception 'end must be after start'; end if;
  insert into public.parties(host_id,title,starts_at,ends_at,timezone,description,party_type,arrival_from,arrival_until,venue_label,max_guests)
  values(v_user_id,trim(p_title),p_starts_at,p_ends_at,p_timezone,p_description,p_party_type,p_arrival_from,p_arrival_until,p_venue_label,p_max_guests)
  returning id into v_party_id;
  insert into public.party_members(party_id,user_id,display_name,role,status,joined_at)
  select v_party_id,v_user_id,coalesce(nullif(p.display_name,''),u.email,'Host'),'host','accepted',now()
  from public.profiles p join auth.users u on u.id=p.id where p.id=v_user_id;
  return v_party_id;
end;
$$;
revoke all on function public.create_party(text,timestamptz,timestamptz,text,text,text,timestamptz,timestamptz,text,integer) from public,anon;
grant execute on function public.create_party(text,timestamptz,timestamptz,text,text,text,timestamptz,timestamptz,text,integer) to authenticated;

-- RLS on every app table.
alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.guest_preferences enable row level security;
alter table public.media_assets enable row level security;
alter table public.awards enable row level security;
alter table public.nominations enable row level security;
alter table public.votes enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;
alter table public.user_crypto_keys enable row level security;
alter table public.party_keys enable row level security;

create policy profile_read_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_insert_self on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profile_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

create policy party_read_members on public.parties for select to authenticated using(public.is_party_member(id));
create policy party_update_admin on public.parties for update to authenticated using(public.has_party_role(id,array['host','cohost']::public.party_role[])) with check(public.has_party_role(id,array['host','cohost']::public.party_role[]));
create policy party_delete_host on public.parties for delete to authenticated using(host_id=(select auth.uid()));

create policy member_read_party on public.party_members for select to authenticated using(public.is_party_member(party_id) or user_id=(select auth.uid()));
-- No direct insert or role updates; use reviewed RPCs for invitations and role changes.

create policy invitation_read_admin on public.invitations for select to authenticated using(public.has_party_role(party_id,array['host','cohost','guest_manager']::public.party_role[]));
create policy invitation_create_admin on public.invitations for insert to authenticated with check(created_by=(select auth.uid()) and public.has_party_role(party_id,array['host','cohost','guest_manager']::public.party_role[]));
create policy invitation_update_admin on public.invitations for update to authenticated using(public.has_party_role(party_id,array['host','cohost','guest_manager']::public.party_role[])) with check(public.has_party_role(party_id,array['host','cohost','guest_manager']::public.party_role[]));

create policy rsvp_read_self_or_admin on public.rsvps for select to authenticated using(public.has_party_role(party_id,array['host','cohost','guest_manager']::public.party_role[]) or exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));
create policy rsvp_create_self on public.rsvps for insert to authenticated with check(exists(select 1 from public.party_members pm where pm.id=member_id and pm.party_id=party_id and pm.user_id=(select auth.uid()) and pm.status='accepted'));
create policy rsvp_update_self on public.rsvps for update to authenticated using(exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid()))) with check(exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));

create policy preference_read_self_or_host on public.guest_preferences for select to authenticated using(public.has_party_role(party_id,array['host','cohost']::public.party_role[]) or exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));
create policy preference_create_self on public.guest_preferences for insert to authenticated with check(exists(select 1 from public.party_members pm where pm.id=member_id and pm.party_id=party_id and pm.user_id=(select auth.uid())));
create policy preference_update_self on public.guest_preferences for update to authenticated using(exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid()))) with check(exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));

create policy media_read_members on public.media_assets for select to authenticated using(public.is_party_member(party_id) and deleted_at is null);
create policy media_create_self on public.media_assets for insert to authenticated with check(public.is_party_member(party_id) and exists(select 1 from public.party_members pm where pm.id=uploader_member_id and pm.party_id=party_id and pm.user_id=(select auth.uid())));
create policy media_update_uploader_or_mod on public.media_assets for update to authenticated using(public.has_party_role(party_id,array['host','gallery_moderator']::public.party_role[]) or exists(select 1 from public.party_members pm where pm.id=uploader_member_id and pm.user_id=(select auth.uid()))) with check(public.is_party_member(party_id));

create policy award_read_members on public.awards for select to authenticated using(public.is_party_member(party_id));
create policy award_manage_admin on public.awards for all to authenticated using(public.has_party_role(party_id,array['host','cohost']::public.party_role[])) with check(public.has_party_role(party_id,array['host','cohost']::public.party_role[]));
create policy nomination_read_members on public.nominations for select to authenticated using(exists(select 1 from public.awards a where a.id=award_id and public.is_party_member(a.party_id)));
create policy vote_read_after_reveal on public.votes for select to authenticated using(exists(select 1 from public.awards a where a.id=award_id and a.status='revealed' and public.is_party_member(a.party_id)));
-- No direct vote insert: add a transactional, replay-safe cast_vote RPC before enabling awards.

create policy payment_request_read_members on public.payment_requests for select to authenticated using(public.is_party_member(party_id));
create policy payment_request_manage_finance on public.payment_requests for all to authenticated using(public.has_party_role(party_id,array['host','finance_admin']::public.party_role[])) with check(public.has_party_role(party_id,array['host','finance_admin']::public.party_role[]));
create policy payment_read_finance_or_self on public.payments for select to authenticated using(exists(select 1 from public.payment_requests pr where pr.id=payment_request_id and public.has_party_role(pr.party_id,array['host','finance_admin']::public.party_role[])) or exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));

create policy audit_read_host on public.audit_events for select to authenticated using(public.has_party_role(party_id,array['host']::public.party_role[]));
create policy user_crypto_key_read_self on public.user_crypto_keys for select to authenticated using(user_id=(select auth.uid()));
create policy user_crypto_key_write_self on public.user_crypto_keys for insert to authenticated with check(user_id=(select auth.uid()));
create policy user_crypto_key_update_self on public.user_crypto_keys for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy party_key_read_self on public.party_keys for select to authenticated using(exists(select 1 from public.party_members pm where pm.id=member_id and pm.user_id=(select auth.uid())));
create policy party_key_write_admin on public.party_keys for insert to authenticated with check(public.has_party_role(party_id,array['host','cohost']::public.party_role[]));

revoke all on all tables in schema public from anon;
grant select,insert,update on public.profiles to authenticated;
grant select,update,delete on public.parties to authenticated;
grant select on public.party_members to authenticated;
grant select,insert,update on public.invitations to authenticated;
grant select,insert,update on public.rsvps to authenticated;
grant select,insert,update on public.guest_preferences to authenticated;
grant select,insert,update on public.media_assets to authenticated;
grant select,insert,update,delete on public.awards to authenticated;
grant select on public.nominations,public.votes to authenticated;
grant select,insert,update on public.payment_requests to authenticated;
grant select on public.payments,public.audit_events to authenticated;
grant select,insert,update on public.user_crypto_keys to authenticated;
grant select,insert on public.party_keys to authenticated;
