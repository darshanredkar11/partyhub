-- Secure RSVP editing: invitation links may create a guest response, but cannot
-- overwrite another guest's response merely by guessing their display name.
alter table public.guest_rsvps
  add column if not exists edit_token_hash bytea;

alter table public.guest_rsvps
  drop constraint if exists guest_rsvps_edit_token_hash_length_check;
alter table public.guest_rsvps
  add constraint guest_rsvps_edit_token_hash_length_check
  check (edit_token_hash is null or octet_length(edit_token_hash) = 32);

drop function if exists public.submit_guest_rsvp(text, text, text, integer, text);

create function public.submit_guest_rsvp(
  p_token text,
  p_display_name text,
  p_response text,
  p_guest_count integer default 1,
  p_dietary_type text default null,
  p_edit_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_rsvp_id uuid;
  v_existing_edit_hash bytea;
  v_edit_token text;
begin
  if p_token is null or p_token !~* '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation';
  end if;
  if p_response is null or p_response not in ('yes','no','maybe') then
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
  if p_edit_token is not null and p_edit_token !~* '^[0-9a-f]{64}$' then
    raise exception 'Invalid RSVP edit permission';
  end if;

  -- Serialise submissions for one invitation. This makes max_uses enforcement
  -- atomic even when several guests submit at the same time.
  select * into v_invitation
  from public.invitations i
  where i.token_hash = extensions.digest(convert_to(lower(trim(p_token)), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or revoked';
  end if;
  if not exists (
    select 1 from public.parties p
    where p.id = v_invitation.party_id and p.status = 'published'
  ) then
    raise exception 'Party is not accepting RSVPs';
  end if;

  select id, edit_token_hash
    into v_rsvp_id, v_existing_edit_hash
  from public.guest_rsvps
  where invitation_id = v_invitation.id
    and lower(display_name) = lower(trim(p_display_name));

  if v_rsvp_id is not null then
    if p_edit_token is null
      or v_existing_edit_hash is null
      or v_existing_edit_hash <> extensions.digest(convert_to(lower(trim(p_edit_token)), 'UTF8'), 'sha256') then
      raise exception 'An RSVP with this name already exists. Use the original browser or device to update it.';
    end if;

    update public.guest_rsvps
    set display_name = trim(p_display_name), response = p_response,
        guest_count = p_guest_count, dietary_type = p_dietary_type
    where id = v_rsvp_id;

    return jsonb_build_object('rsvp_id', v_rsvp_id, 'edit_token', null);
  end if;

  if p_edit_token is not null then
    raise exception 'RSVP edit permission does not match this guest name';
  end if;
  if v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'This invitation has reached its guest limit';
  end if;

  v_edit_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.guest_rsvps (
    party_id, invitation_id, display_name, response, guest_count,
    dietary_type, edit_token_hash
  ) values (
    v_invitation.party_id, v_invitation.id, trim(p_display_name),
    p_response, p_guest_count, p_dietary_type,
    extensions.digest(convert_to(v_edit_token, 'UTF8'), 'sha256')
  ) returning id into v_rsvp_id;

  update public.invitations
  set uses_count = uses_count + 1
  where id = v_invitation.id;

  return jsonb_build_object('rsvp_id', v_rsvp_id, 'edit_token', v_edit_token);
end;
$$;

revoke all on function public.submit_guest_rsvp(text, text, text, integer, text, text) from public, authenticated;
grant execute on function public.submit_guest_rsvp(text, text, text, integer, text, text) to anon, authenticated;

comment on column public.guest_rsvps.edit_token_hash is
  'SHA-256 hash of a per-response secret. The raw edit token is returned once to the guest browser and is never stored.';
