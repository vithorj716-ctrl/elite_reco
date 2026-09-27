DROP POLICY IF EXISTS "registra historico" ON public.ordem_historico;
CREATE POLICY "registra historico"
ON public.ordem_historico FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens o
    WHERE o.id = ordem_historico.ordem_id
      AND (
        public.equipe(auth.uid())
        OR o.agente_id = public.agente_do_usuario(auth.uid())
        OR o.locadora_id = public.locadora_do_usuario(auth.uid())
      )
  )
);