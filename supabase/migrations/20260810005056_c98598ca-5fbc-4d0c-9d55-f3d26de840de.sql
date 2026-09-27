DROP POLICY IF EXISTS "ordens por nivel" ON public.ordens;
CREATE POLICY "ordens por nivel"
ON public.ordens
FOR SELECT
TO authenticated
USING (
  equipe(auth.uid())
  OR locadora_id = locadora_do_usuario(auth.uid())
  OR agente_id = agente_do_usuario(auth.uid())
  OR agente_auxiliar_id = agente_do_usuario(auth.uid())
);