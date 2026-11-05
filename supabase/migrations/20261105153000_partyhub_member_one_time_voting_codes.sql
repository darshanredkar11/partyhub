alter table public.poll_voter_tokens
  add column if not exists party_member_id uuid references public.party_members(id) on delete cascade;

create unique index if not exists poll_voter_tokens_poll_member_unique
  on public.poll_voter_tokens(poll_id, party_member_id)
  where party_member_id is not null;

create or replace function public.create_poll_member_codes(p_poll_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_party_id uuid; v_member record; v_code text; v_id uuid; v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in as the party host.'; end if;
  select party_id into v_party_id from public.award_polls where id=p_poll_id and status='open';
  if v_party_id is null or not public.is_party_admin(v_party_id) then
    raise exception 'Only the party host can generate member codes for an open poll.';
  end if;
  for v_member in
    select pm.id as member_id,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),u.email,'Party member') as member_name
    from public.party_members pm join auth.users u on u.id=pm.user_id
    where pm.party_id=v_party_id and pm.status='accepted' order by member_name
  loop
    if exists(select 1 from public.poll_voter_tokens where poll_id=p_poll_id and party_member_id=v_member.member_id) then continue; end if;
    v_code := upper(encode(extensions.gen_random_bytes(5),'hex'));
    insert into public.poll_voter_tokens(poll_id,token_hash,invited_name,party_member_id,created_by)
    values(p_poll_id,extensions.digest(convert_to(v_code,'UTF8'),'sha256'),v_member.member_name,v_member.member_id,auth.uid())
    returning id into v_id;
    v_items := v_items || jsonb_build_array(jsonb_build_object('id',v_id,'member_id',v_member.member_id,'member_name',v_member.member_name,'code',v_code,'used',false));
  end loop;
  return v_items;
end; $$;

create or replace function public.cast_member_award_vote_by_code(p_poll_id uuid,p_option_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token public.poll_voter_tokens%rowtype; v_status text;
begin
  if p_code is null or char_length(trim(p_code)) <> 10 then raise exception 'Enter your 10-character voting code.'; end if;
  select * into v_token from public.poll_voter_tokens
  where poll_id=p_poll_id and party_member_id is not null
    and token_hash=extensions.digest(convert_to(upper(trim(p_code)),'UTF8'),'sha256')
    and consumed_at is null and (expires_at is null or expires_at>now()) for update;
  if not found then raise exception 'This voting code is invalid or has already been used.'; end if;
  select status into v_status from public.award_polls where id=p_poll_id for update;
  if not found or v_status <> 'open' then raise exception 'This poll is closed.'; end if;
  if not exists(select 1 from public.award_poll_options where id=p_option_id and poll_id=p_poll_id) then raise exception 'Choose a valid option.'; end if;
  update public.poll_voter_tokens set consumed_at=now() where id=v_token.id;
  insert into public.award_poll_votes(poll_id,option_id,voter_token_id) values(p_poll_id,p_option_id,v_token.id);
  return public.get_public_award_poll(p_poll_id);
end; $$;

revoke all on function public.create_poll_member_codes(uuid) from public, anon;
grant execute on function public.create_poll_member_codes(uuid) to authenticated;
revoke all on function public.cast_member_award_vote_by_code(uuid,uuid,text) from public;
grant execute on function public.cast_member_award_vote_by_code(uuid,uuid,text) to anon, authenticated;
