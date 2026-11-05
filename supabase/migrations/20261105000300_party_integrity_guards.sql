-- Guard fields whose integrity is not expressible through the existing table checks.
create or replace function public.validate_party_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.timezone
  ) then
    raise exception 'Invalid party time zone';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_party_host_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.host_id is distinct from old.host_id then
    raise exception 'Party host cannot be changed after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists parties_validate_timezone on public.parties;
create trigger parties_validate_timezone
before insert or update on public.parties
for each row execute function public.validate_party_timezone();

drop trigger if exists parties_prevent_host_change on public.parties;
create trigger parties_prevent_host_change
before update on public.parties
for each row execute function public.prevent_party_host_change();

alter table public.invitations
  drop constraint if exists invitations_token_hash_length_check;
alter table public.invitations
  add constraint invitations_token_hash_length_check
  check (octet_length(token_hash) = 32);

alter table public.invitations
  drop constraint if exists invitations_uses_within_limit_check;
alter table public.invitations
  add constraint invitations_uses_within_limit_check
  check (uses_count <= max_uses);

revoke all on function public.validate_party_timezone() from public, anon, authenticated;
revoke all on function public.prevent_party_host_change() from public, anon, authenticated;
