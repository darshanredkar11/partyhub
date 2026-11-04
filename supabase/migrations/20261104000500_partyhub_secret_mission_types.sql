-- Distinguish mission assignment from completion while keeping both private.
alter table public.party_game_entries drop constraint if exists party_game_entries_entry_type_check;
alter table public.party_game_entries add constraint party_game_entries_entry_type_check
  check (entry_type in ('mission_assigned','mission_completed','bingo_progress','icebreaker_answer','compliment'));

drop policy if exists game_entries_read_members on public.party_game_entries;
create policy game_entries_read_members on public.party_game_entries
for select to authenticated using (
  public.is_party_member(party_id)
  and (
    entry_type not in ('mission_assigned','mission_completed')
    or user_id=(select auth.uid())
    or public.is_party_admin(party_id)
  )
);
