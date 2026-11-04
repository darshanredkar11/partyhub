-- Enable Realtime for safe party activity and member-scoped records.
do $$
declare
  v_table_name text;
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table_name in array array[
      'party_activities','guest_rsvps','party_schedule_items',
      'party_awards','party_passport_stamps','media_assets','party_game_entries'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime'
          and schemaname='public'
          and tablename=v_table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I',v_table_name);
      end if;
    end loop;
  end if;
end;
$$;
