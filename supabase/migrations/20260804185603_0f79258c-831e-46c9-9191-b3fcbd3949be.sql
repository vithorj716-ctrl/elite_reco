CREATE POLICY "evidencias leitura" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (
      public.equipe(auth.uid())
      OR (storage.foldername(name))[2] = public.locadora_do_usuario(auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.ordens o
        WHERE o.id::text = (storage.foldername(name))[4]
          AND o.agente_id = public.agente_do_usuario(auth.uid())
      )
    )
  );

CREATE POLICY "evidencias envio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencias'
    AND (
      public.equipe(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.ordens o
        WHERE o.id::text = (storage.foldername(name))[4]
          AND o.agente_id = public.agente_do_usuario(auth.uid())
      )
    )
  );

CREATE POLICY "evidencias exclusao equipe" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidencias' AND public.equipe(auth.uid()));