-- Allow invitees to optionally become authenticated party members after guest-first RSVP.
create or replace function public.accept_party_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_display_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in is required to join the party space';
  end if;
  if not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.phone_confirmed_at is not null) then
    raise exception 'Verify your mobile number before joining a party';
  end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 256 then
    raise exception 'Invalid invitation';
  end if;

  select * into v_invitation
  from public.invitations i
  where i.token_hash=extensions.digest(convert_to(trim(p_token),'UTF8'),'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at>now())
  limit 1;

  if not found then
    raise exception 'Invitation is invalid, expired or revoked';
  end if;
  if not exists(select 1 from public.parties p where p.id=v_invitation.party_id and p.status='published') then
    raise exception 'Party is not accepting members';
  end if;

  select coalesce(p.display_name,'Party guest') into v_display_name
  from public.profiles p where p.id=(select auth.uid());

  insert into public.party_members as existing_member(party_id,user_id,role,status)
  values(v_invitation.party_id,(select auth.uid()),'guest','accepted')
  on conflict (party_id,user_id) do update
    set status='accepted'
    where existing_member.role<>'host';

  insert into public.party_activities(party_id,actor_user_id,actor_label,activity_type,message)
  values(v_invitation.party_id,(select auth.uid()),v_display_name,'guest_joined',v_display_name || ' joined the party space');

  return v_invitation.party_id;
end;
$$;

revoke all on function public.accept_party_invitation(text) from public,anon;
grant execute on function public.accept_party_invitation(text) to authenticated;
comment on function public.accept_party_invitation(text) is 'Authenticated invitees can opt into party membership after phone verification; RSVP itself remains guest-first.';
