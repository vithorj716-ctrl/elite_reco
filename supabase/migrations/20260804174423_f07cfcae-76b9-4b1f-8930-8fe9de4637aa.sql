CREATE POLICY "equipe le documentos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (
    public.equipe(auth.uid())
    OR (storage.foldername(name))[1] = public.agente_do_usuario(auth.uid())::text
  ));

CREATE POLICY "equipe envia documentos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND (
    public.equipe(auth.uid())
    OR (storage.foldername(name))[1] = public.agente_do_usuario(auth.uid())::text
  ));

CREATE POLICY "equipe atualiza documentos storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND public.equipe(auth.uid()))
  WITH CHECK (bucket_id = 'documentos' AND public.equipe(auth.uid()));

CREATE POLICY "equipe remove documentos storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND public.equipe(auth.uid()));