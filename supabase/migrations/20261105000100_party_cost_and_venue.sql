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
