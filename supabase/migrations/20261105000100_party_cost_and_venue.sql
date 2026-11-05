-- PartyHub: optional event cost and dedicated venue map link.
alter table public.parties
  add column if not exists cost_amount numeric(12,2),
  add column if not exists cost_basis text not null default 'total',
  add column if not exists cost_negotiable boolean not null default false,
  add column if not exists venue_map_url text;

alter table public.parties
  drop constraint if exists parties_cost_amount_nonnegative,
  add constraint parties_cost_amount_nonnegative
    check (cost_amount is null or cost_amount >= 0),
  drop constraint if exists parties_cost_basis_valid,
  add constraint parties_cost_basis_valid
    check (cost_basis in ('per_person','per_venue','per_hour','total')),
  drop constraint if exists parties_venue_map_url_valid,
  add constraint parties_venue_map_url_valid
    check (venue_map_url is null or (
      char_length(venue_map_url) <= 2048
      and venue_map_url ~* '^https://'
      and (
        venue_map_url ~* '^https://(www\\.)?google\\.com/maps'
        or venue_map_url ~* '^https://maps\\.google\\.com'
        or venue_map_url ~* '^https://maps\\.app\\.goo\\.gl'
        or venue_map_url ~* '^https://goo\\.gl/maps'
        or venue_map_url ~* '^https://maps\\.apple\\.com'
      )
    ));

comment on column public.parties.cost_amount is 'Optional event cost amount in the selected currency.';
comment on column public.parties.cost_basis is 'Whether cost is per person, venue, hour, or the total budget.';
comment on column public.parties.cost_negotiable is 'Whether the listed cost is negotiable.';
comment on column public.parties.venue_map_url is 'Validated Google Maps or Apple Maps sharing URL.';

-- Include the dedicated map URL in the safe, public invitation preview.
drop function if exists public.get_invitation_preview(text);
create function public.get_invitation_preview(p_token text)
returns table (
  party_id uuid,
  title text,
  description text,
  party_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  arrival_from timestamptz,
  arrival_until timestamptz,
  timezone text,
  venue_map_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.description, p.party_type, p.starts_at, p.ends_at,
         p.arrival_from, p.arrival_until, p.timezone, p.venue_map_url
  from public.invitations i
  join public.parties p on p.id = i.party_id
  where i.token_hash = extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and p.status = 'published'
  limit 1;
$$;
revoke all on function public.get_invitation_preview(text) from public, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
