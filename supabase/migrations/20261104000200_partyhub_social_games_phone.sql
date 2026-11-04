-- PartyHub social games, inclusive profiles, verified phone numbers and activity feed.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists pronouns text check (pronouns is null or char_length(pronouns) <= 40),
  add column if not exists pronouns_visibility text not null default 'private'
    check (pronouns_visibility in ('private','party_members'));

create or replace function public.sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id,email,display_name,phone_e164,phone_verified_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name',''),
    new.phone,
    case when new.phone_confirmed_at is not null then new.phone_confirmed_at else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    phone_e164 = excluded.phone_e164,
    phone_verified_at = excluded.phone_verified_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, phone, phone_confirmed_at on auth.users
for each row execute function public.sync_auth_profile();
revoke all on function public.sync_auth_profile() from public, anon, authenticated;

create table if not exists public.party_activities (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  activity_type text not null check (activity_type in
    ('party_created','invite_shared','rsvp_received','mission_completed','stamp_earned',
     'award_created','vote_cast','photo_added','game_started','guest_joined')),
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.party_game_cards (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  game_type text not null check (game_type in ('secret_mission','bingo','icebreaker','compliment')),
  title text not null check (char_length(title) between 1 and 100),
  content jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.party_game_entries (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  game_card_id uuid references public.party_game_cards(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  guest_name text,
  entry_type text not null check (entry_type in ('mission_completed','bingo_progress','icebreaker_answer','compliment')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (user_id is not null or guest_name is not null)
);

create table if not exists public.party_passport_stamps (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  guest_name text,
  stamp_key text not null,
  stamp_label text not null,
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_id is not null or guest_name is not null)
);

create table if not exists public.party_awards (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 300),
  nominees jsonb not null default '[]'::jsonb,
  anonymous_voting boolean not null default true,
  is_open boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.party_award_votes (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.party_awards(id) on delete cascade,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  nominee_label text not null check (char_length(nominee_label) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (award_id,voter_user_id)
);

create index if not exists party_activities_party_created_idx on public.party_activities(party_id,created_at desc);
create index if not exists party_game_cards_party_type_idx on public.party_game_cards(party_id,game_type);
create index if not exists party_game_entries_party_created_idx on public.party_game_entries(party_id,created_at desc);
create index if not exists party_passport_party_user_idx on public.party_passport_stamps(party_id,user_id);
create index if not exists party_awards_party_idx on public.party_awards(party_id,created_at desc);

alter table public.party_activities enable row level security;
alter table public.party_game_cards enable row level security;
alter table public.party_game_entries enable row level security;
alter table public.party_passport_stamps enable row level security;
alter table public.party_awards enable row level security;
alter table public.party_award_votes enable row level security;

revoke all on public.party_activities,public.party_game_cards,public.party_game_entries,
  public.party_passport_stamps,public.party_awards,public.party_award_votes from anon,authenticated;

grant select on public.party_activities to authenticated;
grant insert on public.party_activities to authenticated;
grant select,insert,update,delete on public.party_game_cards to authenticated;
grant select,insert on public.party_game_entries to authenticated;
grant select,insert on public.party_passport_stamps to authenticated;
grant select,insert,update,delete on public.party_awards to authenticated;
grant select,insert on public.party_award_votes to authenticated;

create policy activities_read_members on public.party_activities
for select to authenticated using (public.is_party_member(party_id));
create policy activities_write_members on public.party_activities
for insert to authenticated with check (
  public.is_party_member(party_id) and (actor_user_id is null or actor_user_id=(select auth.uid()))
);

create policy game_cards_read_members on public.party_game_cards
for select to authenticated using (public.is_party_member(party_id));
create policy game_cards_manage_admin on public.party_game_cards
for all to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id) and (created_by is null or created_by=(select auth.uid())));

create policy game_entries_read_members on public.party_game_entries
for select to authenticated using (public.is_party_member(party_id));
create policy game_entries_insert_members on public.party_game_entries
for insert to authenticated with check (
  public.is_party_member(party_id) and user_id=(select auth.uid())
);

create policy passport_read_members on public.party_passport_stamps
for select to authenticated using (public.is_party_member(party_id));
create policy passport_award_admin on public.party_passport_stamps
for insert to authenticated with check (
  public.is_party_admin(party_id) and awarded_by=(select auth.uid())
);

create policy awards_read_members on public.party_awards
for select to authenticated using (public.is_party_member(party_id));
create policy awards_manage_admin on public.party_awards
for all to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id) and created_by=(select auth.uid()));

create policy votes_read_members on public.party_award_votes
for select to authenticated using (
  exists (select 1 from public.party_awards a where a.id=award_id and public.is_party_member(a.party_id))
);
create policy votes_insert_members on public.party_award_votes
for insert to authenticated with check (
  voter_user_id=(select auth.uid())
  and exists (
    select 1 from public.party_awards a
    where a.id=award_id and a.is_open and public.is_party_member(a.party_id)
  )
);

-- Optional profile pronouns are visible to party members only when the owner opts in.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated using (id=(select auth.uid()));
create policy profiles_select_party_optin on public.profiles
for select to authenticated using (
  pronouns_visibility='party_members'
  and exists (
    select 1 from public.party_members viewer
    join public.party_members owner on owner.party_id=viewer.party_id
    where viewer.user_id=(select auth.uid())
      and viewer.status='accepted'
      and owner.user_id=profiles.id
      and owner.status='accepted'
  )
);

-- Private by default: phone numbers and pronouns are not exposed to other party members.
comment on column public.profiles.phone_e164 is 'Verified account phone in E.164 format; never expose to other members by default.';
comment on column public.profiles.pronouns is 'Optional self-described pronouns; never required for account creation or party participation.';
comment on table public.party_award_votes is 'One vote per authenticated member per award. Voter identity is not exposed in client UI.';
