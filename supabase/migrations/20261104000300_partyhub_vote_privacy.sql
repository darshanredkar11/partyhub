-- Tighten anonymous voting visibility and allow self-earned passport stamps.
drop policy if exists passport_award_admin on public.party_passport_stamps;
create policy passport_award_admin on public.party_passport_stamps
for insert to authenticated with check (
  (public.is_party_admin(party_id) and awarded_by=(select auth.uid()))
  or
  (public.is_party_member(party_id) and user_id=(select auth.uid()) and awarded_by is null)
);

revoke select on public.party_award_votes from authenticated;
drop policy if exists votes_read_members on public.party_award_votes;

create or replace function public.get_party_award_results(p_award_id uuid)
returns table (nominee_label text, vote_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.nominee_label, count(*)::bigint
  from public.party_award_votes v
  join public.party_awards a on a.id=v.award_id
  where v.award_id=p_award_id
    and public.is_party_member(a.party_id)
  group by v.nominee_label
  order by count(*) desc, v.nominee_label;
$$;
revoke all on function public.get_party_award_results(uuid) from public, anon;
grant execute on function public.get_party_award_results(uuid) to authenticated;
