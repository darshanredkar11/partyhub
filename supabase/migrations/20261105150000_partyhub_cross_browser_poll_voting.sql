-- Cross-browser one-vote enforcement for PartyHub award polls.
alter table public.award_poll_votes
  add column if not exists voter_user_id uuid references auth.users(id) on delete set null,
  add column if not exists voter_token_id uuid;

create unique index if not exists award_poll_votes_member_once
  on public.award_poll_votes(poll_id, voter_user_id)
  where voter_user_id is not null;

create table if not exists public.poll_voter_tokens (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.award_polls(id) on delete cascade,
  token_hash bytea not null unique,
  invited_name text,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.poll_voter_tokens enable row level security;
revoke all on public.poll_voter_tokens from anon, authenticated;
revoke all on public.award_poll_votes from anon, authenticated;
grant select on public.award_poll_votes to authenticated;

alter table public.award_poll_votes
  drop constraint if exists award_poll_votes_voter_token_id_fkey;
alter table public.award_poll_votes
  add constraint award_poll_votes_voter_token_id_fkey
  foreign key (voter_token_id) references public.poll_voter_tokens(id) on delete set null;

create unique index if not exists award_poll_votes_guest_token_once
  on public.award_poll_votes(poll_id, voter_token_id)
  where voter_token_id is not null;

create or replace function public.create_poll_guest_links(p_poll_id uuid,p_count integer,p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_party_id uuid; v_token text; v_id uuid; v_items jsonb := '[]'::jsonb; i integer;
begin
 if auth.uid() is null then raise exception 'Sign in as the host to create guest links.'; end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'Generate between 1 and 100 guest links.'; end if;
 select party_id into v_party_id from public.award_polls where id=p_poll_id and status='open';
 if v_party_id is null or not public.is_party_admin(v_party_id) then raise exception 'Only the party host can generate links for an open poll.'; end if;
 if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiry must be in the future.'; end if;
 for i in 1..p_count loop
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.poll_voter_tokens(poll_id,token_hash,expires_at,created_by)
  values(p_poll_id,extensions.digest(convert_to(v_token,'UTF8'),'sha256'),p_expires_at,auth.uid())
  returning id into v_id;
  v_items:=v_items||jsonb_build_array(jsonb_build_object('id',v_id,'token',v_token));
 end loop;
 return v_items;
end; $$;

create or replace function public.cast_member_award_vote(p_poll_id uuid,p_option_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_party_id uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Verify your email or phone to vote.'; end if;
 select party_id,status into v_party_id,v_status from public.award_polls where id=p_poll_id for update;
 if not found or v_status<>'open' then raise exception 'This poll is closed.'; end if;
 if not exists(select 1 from public.party_members where party_id=v_party_id and user_id=auth.uid() and status='accepted') then raise exception 'This verified account is not a member of this celebration.'; end if;
 if not exists(select 1 from public.award_poll_options where id=p_option_id and poll_id=p_poll_id) then raise exception 'Choose a valid option.'; end if;
 insert into public.award_poll_votes(poll_id,option_id,voter_user_id) values(p_poll_id,p_option_id,auth.uid());
 return public.get_public_award_poll(p_poll_id);
exception when unique_violation then raise exception 'You have already voted in this poll.';
end; $$;

create or replace function public.cast_guest_link_award_vote(p_poll_id uuid,p_option_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_token public.poll_voter_tokens%rowtype; v_status text;
begin
 if p_token is null or char_length(p_token)<>64 then raise exception 'This guest voting link is invalid.'; end if;
 select * into v_token from public.poll_voter_tokens
 where poll_id=p_poll_id and token_hash=extensions.digest(convert_to(p_token,'UTF8'),'sha256')
 and consumed_at is null and (expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'This guest voting link has already been used or has expired.'; end if;
 select status into v_status from public.award_polls where id=p_poll_id for update;
 if not found or v_status<>'open' then raise exception 'This poll is closed.'; end if;
 if not exists(select 1 from public.award_poll_options where id=p_option_id and poll_id=p_poll_id) then raise exception 'Choose a valid option.'; end if;
 update public.poll_voter_tokens set consumed_at=now() where id=v_token.id;
 insert into public.award_poll_votes(poll_id,option_id,voter_token_id) values(p_poll_id,p_option_id,v_token.id);
 return public.get_public_award_poll(p_poll_id);
end; $$;

revoke all on function public.create_poll_guest_links(uuid,integer,timestamptz) from public,anon;
revoke all on function public.cast_member_award_vote(uuid,uuid) from public,anon;
revoke all on function public.cast_guest_link_award_vote(uuid,uuid,text) from public,authenticated;
grant execute on function public.create_poll_guest_links(uuid,integer,timestamptz) to authenticated;
grant execute on function public.cast_member_award_vote(uuid,uuid) to authenticated;
grant execute on function public.cast_guest_link_award_vote(uuid,uuid,text) to anon,authenticated;
