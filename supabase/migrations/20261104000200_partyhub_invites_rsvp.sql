-- PartyHub Draft 1: reusable host invite links and idempotent guest RSVP updates.
alter table public.invitations alter column max_uses set default 100;
update public.invitations set max_uses = greatest(max_uses, 100) where revoked_at is null;

create unique index if not exists guest_rsvps_invitation_name_uidx
  on public.guest_rsvps (invitation_id, lower(display_name));

create or replace function public.create_party_invite(p_party_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not public.is_party_admin(p_party_id) then
    raise exception 'Not allowed';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations (party_id, token_hash, expires_at, max_uses, created_by)
  values (
    p_party_id,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    now() + interval '30 days',
    100,
    auth.uid()
  );
  return v_token;
end;
$$;

revoke all on function public.create_party_invite(uuid) from public, anon;
grant execute on function public.create_party_invite(uuid) to authenticated;

create or replace function public.submit_guest_rsvp(
  p_token text,
  p_display_name text,
  p_response text,
  p_guest_count integer default 1,
  p_dietary_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_rsvp_id uuid;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 256 then
    raise exception 'Invalid invitation';
  end if;
  if p_response not in ('yes','no','maybe') then
    raise exception 'Invalid RSVP response';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 100 then
    raise exception 'Invalid display name';
  end if;
  if p_guest_count is null or p_guest_count not between 1 and 20 then
    raise exception 'Invalid guest count';
  end if;
  if p_dietary_type is not null and p_dietary_type not in
    ('none','vegetarian','vegan','jain','non_vegetarian','other') then
    raise exception 'Invalid dietary preference';
  end if;

  select * into v_invitation
  from public.invitations i
  where i.token_hash = extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if not found then raise exception 'Invitation is invalid, expired, or revoked'; end if;
  if not exists (
    select 1 from public.parties p
    where p.id = v_invitation.party_id and p.status = 'published'
  ) then raise exception 'Party is not accepting RSVPs'; end if;

  select id into v_rsvp_id
  from public.guest_rsvps
  where invitation_id = v_invitation.id
    and lower(display_name) = lower(trim(p_display_name));

  if v_rsvp_id is not null then
    update public.guest_rsvps
    set display_name = trim(p_display_name), response = p_response,
        guest_count = p_guest_count, dietary_type = p_dietary_type
    where id = v_rsvp_id;
    return v_rsvp_id;
  end if;

  if v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'This invitation has reached its guest limit';
  end if;

  insert into public.guest_rsvps (
    party_id, invitation_id, display_name, response, guest_count, dietary_type
  ) values (
    v_invitation.party_id, v_invitation.id, trim(p_display_name),
    p_response, p_guest_count, p_dietary_type
  ) returning id into v_rsvp_id;

  update public.invitations set uses_count = uses_count + 1
  where id = v_invitation.id;
  return v_rsvp_id;
end;
$$;

revoke all on function public.submit_guest_rsvp(text, text, text, integer, text) from public, authenticated;
grant execute on function public.submit_guest_rsvp(text, text, text, integer, text) to anon, authenticated;
