-- Storage buckets for Magic Mirror portraits and Tavern Bard songs.
-- Public buckets so we can hand out CDN URLs directly without signing each fetch.
-- RLS on storage.objects scopes writes to the owning user's prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portraits', 'portraits', true, 10485760,
   array['image/jpeg','image/png','image/webp']),
  ('bard-songs', 'bard-songs', true, 20971520,
   array['audio/mpeg','audio/mp3','audio/wav','audio/webm'])
on conflict (id) do nothing;

-- Per-bucket object policies: any authenticated user can write under their own
-- user_id/ prefix. Anyone (including unauthenticated) can read (public bucket).

-- portraits
drop policy if exists portraits_user_write on storage.objects;
create policy portraits_user_write on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists portraits_user_update on storage.objects;
create policy portraits_user_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists portraits_user_delete on storage.objects;
create policy portraits_user_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- bard-songs
drop policy if exists bard_songs_user_write on storage.objects;
create policy bard_songs_user_write on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bard-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists bard_songs_user_update on storage.objects;
create policy bard_songs_user_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'bard-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists bard_songs_user_delete on storage.objects;
create policy bard_songs_user_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bard-songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
