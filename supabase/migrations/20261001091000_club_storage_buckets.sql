-- Storage buckets for the club app (avatars, org-logos, tournament-banners), carried over from
-- the standalone club project. That project's own storage.objects RLS policies weren't captured
-- in its migration history and weren't reachable from this session (different Supabase account/
-- org), so these are written fresh from the app's own documented convention
-- (hamdukchessclub/src/lib/uploads/upload.ts): public read, path `<bucket>/<ownerId>/<file>`,
-- only the owner may write into their own folder. Confirm against the old project's actual
-- policies before relying on this for anything sensitive.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('avatars', 'avatars', true, 5242880),
  ('org-logos', 'org-logos', true, 5242880),
  ('tournament-banners', 'tournament-banners', true, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "club bucket public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'org-logos', 'tournament-banners'));

CREATE POLICY "club bucket owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars', 'org-logos', 'tournament-banners')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "club bucket owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars', 'org-logos', 'tournament-banners')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "club bucket owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars', 'org-logos', 'tournament-banners')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
