CREATE POLICY "locadora registra historico"
ON public.ordem_historico
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens o
    WHERE o.id = ordem_historico.ordem_id
      AND o.locadora_id = public.locadora_do_usuario(auth.uid())
  )
);