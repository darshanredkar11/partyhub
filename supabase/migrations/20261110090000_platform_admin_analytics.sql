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
as $fn$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
 if v_uid is null or not exists(select 1 from public.platform_admins pa where pa.user_id=v_uid) then
  raise exception 'Platform administrator access required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'generated_at',now(),'users_total',(select count(*) from auth.users),
  'users_new_30d',(select count(*) from auth.users where created_at>=now()-interval '30 days'),
  'users_new_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
  'users_active_30d',(select count(distinct actor_id) from (
    select p.host_id actor_id from public.parties p where p.created_at>=now()-interval '30 days'
    union select pm.user_id from public.party_members pm where pm.updated_at>=now()-interval '30 days'
  ) active_users),
  'hosts_total',(select count(distinct host_id) from public.parties),
  'members_total',(select count(distinct user_id) from public.party_members where role<>'host'),
  'parties_total',(select count(*) from public.parties),
  'parties_upcoming',(select count(*) from public.parties where starts_at>=now() and status not in ('cancelled','deleted')),
  'parties_past',(select count(*) from public.parties where ends_at<now()),
  'rsvp_responses',(select count(*) from public.guest_rsvps),
  'rsvp_attending_guests',(select coalesce(sum(guest_count),0) from public.guest_rsvps where response='yes'),
  'polls_total',(select count(*) from public.award_polls),'votes_total',(select count(*) from public.award_poll_votes),
  'signups_daily',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'count',coalesce(s.n,0)) order by d), '[]'::jsonb)
    from generate_series(current_date-29,current_date,interval '1 day') d
    left join (select created_at::date day_key,count(*)::int n from auth.users where created_at>=now()-interval '29 days' group by 1) s on s.day_key=d::date),
  'parties_daily',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'count',coalesce(s.n,0)) order by d), '[]'::jsonb)
    from generate_series(current_date-29,current_date,interval '1 day') d
    left join (select created_at::date day_key,count(*)::int n from public.parties where created_at>=now()-interval '29 days' group by 1) s on s.day_key=d::date),
  'party_types',(select coalesce(jsonb_agg(jsonb_build_object('label',t.party_type,'count',t.n) order by t.n desc), '[]'::jsonb)
    from (select party_type,count(*)::int n from public.parties group by party_type order by count(*) desc limit 6) t)
 ) into v_result;
 return v_result;
end;
$fn$;
revoke all on function public.get_platform_admin_analytics() from public,anon;
grant execute on function public.get_platform_admin_analytics() to authenticated;
