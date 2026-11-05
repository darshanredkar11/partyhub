-- Remove the weaker browser-local voting path now that verified voting is available.
revoke all on function public.cast_anonymous_award_vote(uuid,uuid,uuid) from public,anon,authenticated;
