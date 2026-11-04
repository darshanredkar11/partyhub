-- PartyHub foundation: profiles, parties, memberships, invitations, guest RSVPs, private gallery metadata.
-- Apply with: supabase db reset
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  phone_e164 text,
  phone_country char(2),
  residence_country char(2),
  payment_country char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  party_type text not null default 'house_party'
    check (party_type in ('house_party','birthday','dinner','game_night','celebration','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  arrival_from timestamptz,
  arrival_until timestamptz,
  timezone text not null default 'UTC',
  currency char(3) not null default 'INR' check (currency in ('INR','GBP')),
  venue_ciphertext text,
  venue_iv text,
  venue_encryption_version smallint,
  max_guests integer check (max_guests is null or max_guests between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parties_valid_schedule check (ends_at > starts_at),
  constraint parties_valid_arrival check (
    (arrival_from is null and arrival_until is null)
    or (arrival_from is not null and arrival_until is not null and arrival_until >= arrival_from)
  )
);

create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'guest'
    check (role in ('host','cohost','guest_manager','finance_admin','gallery_moderator','guest')),
  status text not null default 'accepted' check (status in ('invited','accepted','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  token_hash bytea not null unique,
  invited_name text,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  uses_count integer not null default 0 check (uses_count >= 0),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_rsvps (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  response text not null check (response in ('yes','no','maybe')),
  guest_count integer not null default 1 check (guest_count between 1 and 20),
  dietary_type text check (dietary_type is null or dietary_type in ('none','vegetarian','vegan','jain','non_vegetarian','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  uploader_member_id uuid not null references public.party_members(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 524288000),
  encrypted boolean not null default false,
  encryption_version smallint,
  encryption_iv text,
  caption text check (caption is null or char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists parties_host_created_idx on public.parties(host_id, created_at desc);
create index if not exists parties_status_starts_idx on public.parties(status, starts_at);
create index if not exists party_members_user_status_idx on public.party_members(user_id, status);
create index if not exists party_members_party_role_idx on public.party_members(party_id, role, status);
create index if not exists invitations_party_idx on public.invitations(party_id);
create index if not exists guest_rsvps_party_idx on public.guest_rsvps(party_id);
create index if not exists media_assets_party_created_idx on public.media_assets(party_id, created_at desc)
  where deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger parties_set_updated_at before update on public.parties
for each row execute function public.set_updated_at();
create trigger party_members_set_updated_at before update on public.party_members
for each row execute function public.set_updated_at();
create trigger guest_rsvps_set_updated_at before update on public.guest_rsvps
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_partyhub on auth.users;
create trigger on_auth_user_created_partyhub
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_party_member(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.party_members pm
    where pm.party_id = p_party_id
      and pm.user_id = (select auth.uid())
      and pm.status = 'accepted'
  );
$$;

create or replace function public.has_party_role(p_party_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.party_members pm
    where pm.party_id = p_party_id
      and pm.user_id = (select auth.uid())
      and pm.status = 'accepted'
      and pm.role = any (p_roles)
  );
$$;

create or replace function public.is_party_admin(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_party_role(p_party_id, array['host','cohost']::text[]);
$$;

create or replace function public.add_party_host_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.party_members (party_id, user_id, role, status)
  values (new.id, new.host_id, 'host', 'accepted')
  on conflict (party_id, user_id) do nothing;
  return new;
end;
$$;

create trigger parties_add_host_membership
after insert on public.parties
for each row execute function public.add_party_host_membership();

-- Invitation preview exposes only event details intentionally safe for invite recipients.
create or replace function public.get_invitation_preview(p_token text)
returns table (
  party_id uuid,
  title text,
  description text,
  party_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  arrival_from timestamptz,
  arrival_until timestamptz,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.description, p.party_type, p.starts_at, p.ends_at,
         p.arrival_from, p.arrival_until, p.timezone
  from public.invitations i
  join public.parties p on p.id = i.party_id
  where i.token_hash = extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and i.uses_count < i.max_uses
    and p.status = 'published'
  limit 1;
$$;

create or replace function public.submit_guest_rsvp(
  p_token text,
  p_display_name text,
  p_response text,
  p_guest_count integer default 1,
  p_dietary_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_rsvp_id uuid;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 256 then
    raise exception 'Invalid invitation';
  end if;
  if p_response not in ('yes','no','maybe') then
    raise exception 'Invalid RSVP response';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 100 then
    raise exception 'Invalid display name';
  end if;
  if p_guest_count is null or p_guest_count not between 1 and 20 then
    raise exception 'Invalid guest count';
  end if;
  if p_dietary_type is not null and p_dietary_type not in
    ('none','vegetarian','vegan','jain','non_vegetarian','other') then
    raise exception 'Invalid dietary preference';
  end if;

  select * into v_invitation
  from public.invitations i
  where i.token_hash = extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and i.uses_count < i.max_uses
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;

  if not exists (
    select 1 from public.parties p
    where p.id = v_invitation.party_id and p.status = 'published'
  ) then
    raise exception 'Party is not accepting RSVPs';
  end if;

  insert into public.guest_rsvps (
    party_id, invitation_id, display_name, response, guest_count, dietary_type
  )
  values (
    v_invitation.party_id, v_invitation.id, trim(p_display_name),
    p_response, p_guest_count, p_dietary_type
  )
  returning id into v_rsvp_id;

  update public.invitations
  set uses_count = uses_count + 1
  where id = v_invitation.id;

  return v_rsvp_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.invitations enable row level security;
alter table public.guest_rsvps enable row level security;
alter table public.media_assets enable row level security;

-- Remove default broad table access, then grant only what the browser requires.
revoke all on public.profiles, public.parties, public.party_members,
  public.invitations, public.guest_rsvps, public.media_assets from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.parties to authenticated;
grant select, insert, update, delete on public.party_members to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select on public.guest_rsvps to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.add_party_host_membership() from public, anon, authenticated;
revoke all on function public.is_party_member(uuid) from public, anon;
revoke all on function public.has_party_role(uuid, text[]) from public, anon;
revoke all on function public.is_party_admin(uuid) from public, anon;
grant execute on function public.is_party_member(uuid) to authenticated;
grant execute on function public.has_party_role(uuid, text[]) to authenticated;
grant execute on function public.is_party_admin(uuid) to authenticated;

revoke all on function public.get_invitation_preview(text) from public, authenticated;
revoke all on function public.submit_guest_rsvp(text, text, text, integer, text) from public, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
grant execute on function public.submit_guest_rsvp(text, text, text, integer, text) to anon, authenticated;

-- Profiles: users can only see and edit their own profile.
create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Parties: accepted members can read; only the host can create; host/cohost can update/delete.
create policy parties_select_members on public.parties
for select to authenticated using (public.is_party_member(id));
create policy parties_insert_host on public.parties
for insert to authenticated with check (host_id = (select auth.uid()));
create policy parties_update_admin on public.parties
for update to authenticated using (public.is_party_admin(id))
with check (public.is_party_admin(id));
create policy parties_delete_admin on public.parties
for delete to authenticated using (public.is_party_admin(id));

-- Membership: members see their party roster; host/cohost manage roles.
create policy party_members_select_members on public.party_members
for select to authenticated using (public.is_party_member(party_id));
create policy party_members_insert_admin on public.party_members
for insert to authenticated with check (public.is_party_admin(party_id));
create policy party_members_update_admin on public.party_members
for update to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id));
create policy party_members_delete_admin on public.party_members
for delete to authenticated using (
  public.is_party_admin(party_id) and role <> 'host'
);

-- Invitation token hashes are only readable/manageable by party admins.
create policy invitations_select_admin on public.invitations
for select to authenticated using (public.is_party_admin(party_id));
create policy invitations_insert_admin on public.invitations
for insert to authenticated with check (
  public.is_party_admin(party_id) and created_by = (select auth.uid())
);
create policy invitations_update_admin on public.invitations
for update to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id));
create policy invitations_delete_admin on public.invitations
for delete to authenticated using (public.is_party_admin(party_id));

-- Guest RSVP rows are visible only to party admins; anonymous guests use the validated RPC.
create policy guest_rsvps_select_admin on public.guest_rsvps
for select to authenticated using (public.is_party_admin(party_id));

-- Gallery metadata is member-visible; uploader or party admins can update/delete.
create policy media_assets_select_members on public.media_assets
for select to authenticated using (
  public.is_party_member(party_id) and deleted_at is null
);
create policy media_assets_insert_members on public.media_assets
for insert to authenticated with check (
  public.is_party_member(party_id)
  and exists (
    select 1 from public.party_members pm
    where pm.id = uploader_member_id
      and pm.party_id = media_assets.party_id
      and pm.user_id = (select auth.uid())
      and pm.status = 'accepted'
  )
);
create policy media_assets_update_owner_or_admin on public.media_assets
for update to authenticated using (
  public.is_party_member(party_id)
  and (
    public.is_party_admin(party_id)
    or exists (
      select 1 from public.party_members pm
      where pm.id = uploader_member_id and pm.user_id = (select auth.uid())
    )
  )
) with check (public.is_party_member(party_id));
create policy media_assets_delete_owner_or_admin on public.media_assets
for delete to authenticated using (
  public.is_party_admin(party_id)
  or exists (
    select 1 from public.party_members pm
    where pm.id = uploader_member_id
      and pm.user_id = (select auth.uid())
      and pm.status = 'accepted'
  )
);

-- Storage bucket is private. Object path: {party_id}/{member_id}/{asset_id}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'party-media',
  'party-media',
  false,
  524288000,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy party_media_read_members on storage.objects
for select to authenticated using (
  bucket_id = 'party-media'
  and public.is_party_member(((storage.foldername(name))[1])::uuid)
);
create policy party_media_upload_members on storage.objects
for insert to authenticated with check (
  bucket_id = 'party-media'
  and public.is_party_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2]) = (select auth.uid())::text
);
create policy party_media_delete_owner_or_admin on storage.objects
for delete to authenticated using (
  bucket_id = 'party-media'
  and (
    ((storage.foldername(name))[2]) = (select auth.uid())::text
    or public.is_party_admin(((storage.foldername(name))[1])::uuid)
  )
);

comment on table public.parties is 'PartyHub events. Venue ciphertext is selectively encrypted by the client.';
comment on table public.invitations is 'Only SHA-256 hashes of high-entropy invitation tokens are stored.';
comment on table public.guest_rsvps is 'Guest-first RSVP records created through submit_guest_rsvp RPC.';
comment on table public.media_assets is 'Private gallery metadata; media bytes live in the private party-media bucket.';
