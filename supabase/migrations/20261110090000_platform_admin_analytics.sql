create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 created_by uuid null references auth.users(id) on delete set null
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
drop policy if exists platform_admins_read_self on public.platform_admins;
create policy platform_admins_read_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));
insert into public.platform_admins(user_id) values ('37903761-89a2-4546-b314-44e475c758f1'::uuid) on conflict do nothing;

create or replace function public.get_platform_admin_analytics()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
 if v_uid is null or not exists(select 1 from public.platform_admins pa where pa.user_id=v_uid) then
  raise exception 'Platform administrator access required' using errcode='42501';
 end if;
 with signups as (
  select date_trunc('day',u.created_at)::date day,count(*)::int count from auth.users u where u.created_at>=now()-interval '29 days' group by 1
 ), signup_series as (
  select d::date day,coalesce(s.count,0) count from generate_series(current_date-29,current_date,interval '1 day') d left join signups s on s.day=d::date order by day
 ), active_ids as (
  select p.host_id user_id from public.parties p where p.created_at>=now()-interval '30 days'
  union select pm.user_id from public.party_members pm where pm.updated_at>=now()-interval '30 days'
  union select i.created_by user_id from public.invitations i where i.created_at>=now()-interval '30 days'
 ), party_types as (
  select p.party_type label,count(*)::int count from public.parties p group by p.party_type order by count(*) desc,p.party_type limit 6
 ), daily_parties as (
  select date_trunc('day',p.created_at)::date day,count(*)::int count from public.parties p where p.created_at>=now()-interval '29 days' group by 1
 ), party_series as (
  select d::date day,coalesce(p.count,0) count from generate_series(current_date-29,current_date,interval '1 day') d left join daily_parties p on p.day=d::date order by day
 )
 select jsonb_build_object(
  'generated_at',now(),
  'users_total',(select count(*) from auth.users),
  'users_new_30d',(select count(*) from auth.users where created_at>=now()-interval '30 days'),
  'users_new_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
  'users_active_30d',(select count(*) from active_ids),
  'hosts_total',(select count(distinct host_id) from public.parties),
  'members_total',(select count(distinct user_id) from public.party_members where role<>'host'),
  'parties_total',(select count(*) from public.parties),
  'parties_upcoming',(select count(*) from public.parties where starts_at>=now() and status not in ('cancelled','deleted')),
  'parties_past',(select count(*) from public.parties where ends_at<now()),
  'rsvp_responses',(select count(*) from public.guest_rsvps),
  'rsvp_attending_guests',(select coalesce(sum(guest_count),0) from public.guest_rsvps where response='yes'),
  'polls_total',(select count(*) from public.award_polls),
  'votes_total',(select count(*) from public.award_poll_votes),
  'signups_daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',count) order by day) from signup_series),'[]'::jsonb),
  'parties_daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',count) order by day) from party_series),'[]'::jsonb),
  'party_types',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc) from party_types),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
revoke all on function public.get_platform_admin_analytics() from public,anon;
grant execute on function public.get_platform_admin_analytics() to authenticated;
