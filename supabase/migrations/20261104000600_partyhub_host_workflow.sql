-- Complete the host workflow: schedule, venue, RSVP activity, and correct invite capacity.
alter table public.parties
  add column if not exists venue_label text,
  add column if not exists venue_address text;

alter table public.invitations drop constraint if exists invitations_max_uses_check;
alter table public.invitations add constraint invitations_max_uses_check check (max_uses between 1 and 1000);

create table if not exists public.party_schedule_items (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  notes text not null default '' check (char_length(notes) <= 500),
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists party_schedule_party_time_idx on public.party_schedule_items(party_id,starts_at);

alter table public.party_schedule_items enable row level security;
revoke all on public.party_schedule_items from anon,authenticated;
grant select,insert,update,delete on public.party_schedule_items to authenticated;

create policy schedule_read_members on public.party_schedule_items
for select to authenticated using (public.is_party_member(party_id));
create policy schedule_insert_admin on public.party_schedule_items
for insert to authenticated with check (public.is_party_admin(party_id) and created_by=(select auth.uid()));
create policy schedule_update_admin on public.party_schedule_items
for update to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id));
create policy schedule_delete_admin on public.party_schedule_items
for delete to authenticated using (public.is_party_admin(party_id));

drop policy if exists awards_manage_admin on public.party_awards;
create policy awards_insert_members on public.party_awards
for insert to authenticated with check (public.is_party_member(party_id) and created_by=(select auth.uid()));
create policy awards_update_admin on public.party_awards
for update to authenticated using (public.is_party_admin(party_id))
with check (public.is_party_admin(party_id));
create policy awards_delete_admin on public.party_awards
for delete to authenticated using (public.is_party_admin(party_id));

drop policy if exists votes_insert_members on public.party_award_votes;
create policy votes_insert_members on public.party_award_votes
for insert to authenticated with check (
  voter_user_id=(select auth.uid())
  and exists (
    select 1 from public.party_awards a
    where a.id=award_id
      and a.is_open
      and public.is_party_member(a.party_id)
      and exists (
        select 1 from jsonb_array_elements_text(a.nominees) nominee
        where nominee=party_award_votes.nominee_label
      )
  )
);

alter table public.party_activities drop constraint if exists party_activities_activity_type_check;
alter table public.party_activities add constraint party_activities_activity_type_check
  check (activity_type in
    ('party_created','invite_shared','rsvp_received','mission_completed','stamp_earned',
     'award_created','vote_cast','photo_added','game_started','guest_joined','schedule_updated'));

create or replace function public.log_guest_rsvp_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.party_activities(party_id,actor_label,activity_type,message)
  values (
    new.party_id,
    new.display_name,
    'rsvp_received',
    new.display_name || ' responded ' || upper(new.response) ||
      case when new.guest_count > 1 then ' for ' || new.guest_count::text || ' guests' else '' end
  );
  return new;
end;
$$;
drop trigger if exists guest_rsvp_activity on public.guest_rsvps;
create trigger guest_rsvp_activity
after insert on public.guest_rsvps
for each row execute function public.log_guest_rsvp_activity();
revoke all on function public.log_guest_rsvp_activity() from public,anon,authenticated;

comment on column public.parties.venue_address is 'Visible only to accepted party members through parties RLS; never included in invitation preview.';
