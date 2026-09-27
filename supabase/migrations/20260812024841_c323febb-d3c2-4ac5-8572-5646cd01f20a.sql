ALTER TABLE public.motos
  ADD COLUMN IF NOT EXISTS host text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "motos agente le atribuida" ON public.motos;
CREATE POLICY "motos agente le atribuida" ON public.motos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vistorias v
     WHERE v.moto_id = motos.id
       AND v.agente_id IS NOT NULL
       AND v.agente_id = public.agente_do_usuario(auth.uid())
  )
);