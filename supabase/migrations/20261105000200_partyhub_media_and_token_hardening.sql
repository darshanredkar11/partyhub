-- Align invitation token normalization and tighten the unused media foundation.
create or replace function public.get_invitation_preview(p_token text)
returns table (
  party_id uuid,
  title text,
  description text,
  party_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  arrival_from timestamptz,
  arrival_until timestamptz,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.description, p.party_type, p.starts_at, p.ends_at,
         p.arrival_from, p.arrival_until, p.timezone
  from public.invitations i
  join public.parties p on p.id = i.party_id
  where p_token ~* '^[0-9a-f]{64}$'
    and i.token_hash = extensions.digest(convert_to(lower(trim(p_token)), 'UTF8'), 'sha256')
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and p.status = 'published'
  limit 1;
$$;

revoke all on function public.get_invitation_preview(text) from public, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- Foreign-key indexes keep host/invitation/media joins and cascading deletes bounded.
create index if not exists invitations_created_by_idx on public.invitations(created_by);
create index if not exists media_assets_uploader_member_idx on public.media_assets(uploader_member_id);

alter table public.guest_rsvps
  drop constraint if exists guest_rsvps_display_name_no_control_chars;
alter table public.guest_rsvps
  add constraint guest_rsvps_display_name_no_control_chars
  check (display_name !~ '[[:cntrl:]]');

-- The uploader membership must belong to the same party as the media row.
-- Without this condition, a valid membership from another party could be
-- referenced after an UPDATE and create cross-party metadata inconsistencies.
drop policy if exists media_assets_update_owner_or_admin on public.media_assets;
create policy media_assets_update_owner_or_admin on public.media_assets
for update to authenticated using (
  public.is_party_member(party_id)
  and (
    public.is_party_admin(party_id)
    or exists (
      select 1 from public.party_members pm
      where pm.id = uploader_member_id
        and pm.party_id = media_assets.party_id
        and pm.user_id = (select auth.uid())
        and pm.status = 'accepted'
    )
  )
) with check (
  public.is_party_member(party_id)
  and exists (
    select 1 from public.party_members pm
    where pm.id = uploader_member_id
      and pm.party_id = media_assets.party_id
      and pm.status = 'accepted'
  )
  and (
    public.is_party_admin(party_id)
    or exists (
      select 1 from public.party_members pm
      where pm.id = uploader_member_id
        and pm.party_id = media_assets.party_id
        and pm.user_id = (select auth.uid())
        and pm.status = 'accepted'
    )
  )
);

drop policy if exists media_assets_delete_owner_or_admin on public.media_assets;
create policy media_assets_delete_owner_or_admin on public.media_assets
for delete to authenticated using (
  public.is_party_member(party_id)
  and (
    public.is_party_admin(party_id)
    or exists (
      select 1 from public.party_members pm
      where pm.id = uploader_member_id
        and pm.party_id = media_assets.party_id
        and pm.user_id = (select auth.uid())
        and pm.status = 'accepted'
    )
  )
);

-- Storage paths use the authenticated user's UUID in segment two:
-- {party_id}/{user_id}/{asset_id}.{ext}
drop policy if exists party_media_delete_owner_or_admin on storage.objects;
create policy party_media_delete_owner_or_admin on storage.objects
for delete to authenticated using (
  bucket_id = 'party-media'
  and (
    (
      public.is_party_member(((storage.foldername(name))[1])::uuid)
      and ((storage.foldername(name))[2]) = (select auth.uid())::text
    )
    or public.is_party_admin(((storage.foldername(name))[1])::uuid)
  )
);
