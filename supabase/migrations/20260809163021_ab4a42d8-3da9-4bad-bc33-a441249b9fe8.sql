CREATE POLICY "perfis leitura autenticada"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'perfis');

CREATE POLICY "perfis escrita equipe ou proprio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'perfis' AND (
    public.equipe(auth.uid())
    OR (storage.foldername(name))[1] = public.agente_do_usuario(auth.uid())::text
  )
);

CREATE POLICY "perfis atualizacao equipe ou proprio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'perfis' AND (
    public.equipe(auth.uid())
    OR (storage.foldername(name))[1] = public.agente_do_usuario(auth.uid())::text
  )
);

CREATE POLICY "perfis exclusao equipe ou proprio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'perfis' AND (
    public.equipe(auth.uid())
    OR (storage.foldername(name))[1] = public.agente_do_usuario(auth.uid())::text
  )
);