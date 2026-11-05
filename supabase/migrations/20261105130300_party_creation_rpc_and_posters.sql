-- Party creation RPC and optional public party posters.
alter table public.parties add column if not exists poster_url text;

create or replace function public.create_party(
  p_title text,p_description text,p_party_type text,p_starts_at timestamptz,
  p_ends_at timestamptz,p_arrival_from timestamptz,p_arrival_until timestamptz,
  p_timezone text,p_currency text,p_cost_amount numeric,p_cost_basis text,
  p_cost_negotiable boolean,p_venue_map_url text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_host_id uuid := auth.uid(); v_party_id uuid;
begin
  if v_host_id is null then raise exception 'Your sign-in session has expired. Please sign in again.'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then raise exception 'Enter a party title between 1 and 120 characters.'; end if;
  if p_party_type not in ('house_party','birthday','dinner','game_night','celebration','other') then raise exception 'Choose a valid party type.'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'The party end time must be after its start time.'; end if;
  if (p_arrival_from is null) <> (p_arrival_until is null) or (p_arrival_from is not null and p_arrival_until < p_arrival_from) then raise exception 'Please provide a valid arrival window.'; end if;
  if p_currency not in ('INR','GBP') then raise exception 'Choose a supported currency.'; end if;
  if p_cost_amount is not null and p_cost_amount < 0 then raise exception 'Cost cannot be negative.'; end if;
  if p_cost_basis not in ('per_person','per_venue','per_hour','total') then raise exception 'Choose a valid cost basis.'; end if;
  if p_venue_map_url is not null and (char_length(p_venue_map_url)>2048 or p_venue_map_url !~* '^https://' or not (
    p_venue_map_url ~* '^https://(www[.])?google[.]com/maps'
    or p_venue_map_url ~* '^https://maps[.]google[.]com'
    or p_venue_map_url ~* '^https://maps[.]app[.]goo[.]gl'
    or p_venue_map_url ~* '^https://goo[.]gl/maps'
    or p_venue_map_url ~* '^https://maps[.]apple[.]com'
  )) then raise exception 'Paste a valid Google Maps or Apple Maps sharing link.'; end if;
  insert into public.parties(host_id,title,description,party_type,starts_at,ends_at,arrival_from,arrival_until,timezone,currency,status,cost_amount,cost_basis,cost_negotiable,venue_map_url)
  values(v_host_id,trim(p_title),coalesce(trim(p_description),''),p_party_type,p_starts_at,p_ends_at,p_arrival_from,p_arrival_until,coalesce(nullif(trim(p_timezone),''),'UTC'),p_currency,'published',p_cost_amount,p_cost_basis,coalesce(p_cost_negotiable,false),p_venue_map_url)
  returning id into v_party_id;
  return v_party_id;
end;
$$;
revoke all on function public.create_party(text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,numeric,text,boolean,text) from public,anon;
grant execute on function public.create_party(text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,numeric,text,boolean,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('party-posters','party-posters',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists party_posters_host_upload on storage.objects;
create policy party_posters_host_upload on storage.objects for insert to authenticated with check (
 bucket_id='party-posters' and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.parties p where p.id=((storage.foldername(name))[1])::uuid and p.host_id=(select auth.uid()))
);
drop policy if exists party_posters_host_delete on storage.objects;
create policy party_posters_host_delete on storage.objects for delete to authenticated using (
 bucket_id='party-posters' and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.parties p where p.id=((storage.foldername(name))[1])::uuid and p.host_id=(select auth.uid()))
);

drop function if exists public.get_invitation_preview(text);
create function public.get_invitation_preview(p_token text)
returns table(party_id uuid,title text,description text,party_type text,starts_at timestamptz,ends_at timestamptz,arrival_from timestamptz,arrival_until timestamptz,timezone text,venue_map_url text,poster_url text)
language sql stable security definer set search_path = ''
as $$
 select p.id,p.title,p.description,p.party_type,p.starts_at,p.ends_at,p.arrival_from,p.arrival_until,p.timezone,p.venue_map_url,p.poster_url
 from public.invitations i join public.parties p on p.id=i.party_id
 where i.token_hash=extensions.digest(convert_to(trim(p_token),'UTF8'),'sha256')
 and i.revoked_at is null and (i.expires_at is null or i.expires_at>now()) and p.status='published'
 limit 1;
$$;
revoke all on function public.get_invitation_preview(text) from public,authenticated;
grant execute on function public.get_invitation_preview(text) to anon,authenticated;
