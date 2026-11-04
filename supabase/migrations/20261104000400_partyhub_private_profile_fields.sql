-- Keep private contact details inaccessible even when a user opts into a party profile.
revoke all on public.profiles from authenticated;
grant select (id,display_name,pronouns,pronouns_visibility,phone_verified_at,created_at,updated_at)
  on public.profiles to authenticated;
grant update (display_name,pronouns,pronouns_visibility,phone_country)
  on public.profiles to authenticated;

-- Secret mission assignments are visible only to the player and party admins.
drop policy if exists game_entries_read_members on public.party_game_entries;
create policy game_entries_read_members on public.party_game_entries
for select to authenticated using (
  public.is_party_member(party_id)
  and (
    entry_type <> 'mission_completed'
    or user_id=(select auth.uid())
    or public.is_party_admin(party_id)
  )
);

comment on column public.profiles.phone_e164 is 'Private verified E.164 phone. No authenticated client has column-level SELECT permission.';
