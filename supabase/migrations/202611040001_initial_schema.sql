create extension if not exists pgcrypto with schema extensions;
create table if not exists public.parties(
 id uuid primary key default gen_random_uuid(),host_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 120),event_date date not null,
 starts_at time not null,ends_at time not null,venue text,host_note text,
 timezone text not null default 'Asia/Kolkata',currency text not null default 'INR' check(currency in('INR','GBP')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.party_members(party_id uuid not null references public.parties(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'host' check(role in('host','cohost','guest_manager','guest')),created_at timestamptz not null default now(),primary key(party_id,user_id));
create table if not exists public.invitations(id uuid primary key default gen_random_uuid(),party_id uuid not null references public.parties(id) on delete cascade,token_hash text not null unique,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.rsvps(id uuid primary key default gen_random_uuid(),party_id uuid not null references public.parties(id) on delete cascade,invitation_id uuid not null references public.invitations(id) on delete cascade,guest_name text not null check(char_length(trim(guest_name)) between 1 and 100),status text not null check(status in('yes','maybe','no')),food_preference text not null default 'No preference',guest_note text,created_at timestamptz not null default now(),unique(invitation_id,guest_name));
create index if not exists parties_host_date_idx on public.parties(host_id,event_date);
create index if not exists rsvps_party_idx on public.rsvps(party_id);
alter table public.parties enable row level security;alter table public.party_members enable row level security;alter table public.invitations enable row level security;alter table public.rsvps enable row level security;
grant select,insert,update,delete on public.parties to authenticated;grant select on public.party_members to authenticated;grant select,insert,update,delete on public.invitations to authenticated;grant select on public.rsvps to authenticated;
create policy "members read parties" on public.parties for select to authenticated using(exists(select 1 from public.party_members m where m.party_id=id and m.user_id=auth.uid()));
create policy "signed-in host creates party" on public.parties for insert to authenticated with check(host_id=auth.uid());
create policy "host updates party" on public.parties for update to authenticated using(host_id=auth.uid()) with check(host_id=auth.uid());
create policy "host deletes party" on public.parties for delete to authenticated using(host_id=auth.uid());
create policy "members read own membership" on public.party_members for select to authenticated using(user_id=auth.uid());
create policy "hosts manage invitations" on public.invitations for all to authenticated using(exists(select 1 from public.parties p where p.id=party_id and p.host_id=auth.uid())) with check(exists(select 1 from public.parties p where p.id=party_id and p.host_id=auth.uid()));
create policy "members read rsvps" on public.rsvps for select to authenticated using(exists(select 1 from public.party_members m where m.party_id=party_id and m.user_id=auth.uid()));
create or replace function public.add_party_host_member() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.party_members(party_id,user_id,role) values(new.id,new.host_id,'host') on conflict do nothing;return new;end;$$;
drop trigger if exists parties_add_host_member on public.parties;
create trigger parties_add_host_member after insert on public.parties for each row execute function public.add_party_host_member();
create or replace function public.create_party_invite(p_party_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_token text;begin if not exists(select 1 from public.parties p where p.id=p_party_id and p.host_id=auth.uid()) then raise exception 'Not allowed';end if;v_token:=encode(extensions.gen_random_bytes(32),'hex');insert into public.invitations(party_id,token_hash,expires_at) values(p_party_id,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '30 days');return v_token;end;$$;
revoke all on function public.create_party_invite(uuid) from public;grant execute on function public.create_party_invite(uuid) to authenticated;
create or replace function public.submit_guest_rsvp(p_token text,p_guest_name text,p_status text,p_food_preference text default 'No preference',p_guest_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations%rowtype;v_id uuid;begin
 if p_token is null or length(p_token)<32 or length(p_token)>128 then raise exception 'Invalid invitation';end if;
 if char_length(trim(p_guest_name)) not between 1 and 100 then raise exception 'Enter your name';end if;
 if p_status not in('yes','maybe','no') then raise exception 'Invalid RSVP';end if;
 select * into v_inv from public.invitations i where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and i.revoked_at is null and(i.expires_at is null or i.expires_at>now());
 if not found then raise exception 'Invitation expired or invalid';end if;
 insert into public.rsvps(party_id,invitation_id,guest_name,status,food_preference,guest_note) values(v_inv.party_id,v_inv.id,trim(p_guest_name),p_status,coalesce(p_food_preference,'No preference'),p_guest_note)
 on conflict(invitation_id,guest_name) do update set status=excluded.status,food_preference=excluded.food_preference,guest_note=excluded.guest_note returning id into v_id;return v_id;end;$$;
revoke all on function public.submit_guest_rsvp(text,text,text,text,text) from public;grant execute on function public.submit_guest_rsvp(text,text,text,text,text) to anon,authenticated;
create or replace function public.get_public_party_invite(p_token text) returns table(title text,event_date date,starts_at time,ends_at time,venue text,host_note text) language sql security definer set search_path='' as $$
 select p.title,p.event_date,p.starts_at,p.ends_at,p.venue,p.host_note from public.invitations i join public.parties p on p.id=i.party_id where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and i.revoked_at is null and(i.expires_at is null or i.expires_at>now()) limit 1;$$;
revoke all on function public.get_public_party_invite(text) from public;grant execute on function public.get_public_party_invite(text) to anon,authenticated;
