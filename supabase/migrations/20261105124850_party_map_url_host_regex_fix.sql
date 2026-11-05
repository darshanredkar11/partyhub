alter table public.parties
  drop constraint if exists parties_venue_map_url_valid,
  add constraint parties_venue_map_url_valid
    check (venue_map_url is null or (
      char_length(venue_map_url) <= 2048
      and venue_map_url ~* '^https://'
      and (
        venue_map_url ~* '^https://(www[.])?google[.]com/maps'
        or venue_map_url ~* '^https://maps[.]google[.]com'
        or venue_map_url ~* '^https://maps[.]app[.]goo[.]gl'
        or venue_map_url ~* '^https://goo[.]gl/maps'
        or venue_map_url ~* '^https://maps[.]apple[.]com'
      )
    ));