CREATE POLICY "Pet images readable by anyone" ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-images');
CREATE POLICY "Users upload own pet images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own pet images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own pet images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pet-images' AND (storage.foldername(name))[1] = auth.uid()::text);