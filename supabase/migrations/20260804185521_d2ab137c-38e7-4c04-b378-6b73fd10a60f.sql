-- 1. Novos campos nas ordens
ALTER TABLE public.ordens
  ADD COLUMN IF NOT EXISTS locatario text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cpf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone_secundario text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS longitude text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS link_maps text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ultimo_rastreio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS situacao_financeira text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_informado text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resumo_ia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS texto_origem text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS criada_por uuid;

CREATE INDEX IF NOT EXISTS ordens_placa_idx ON public.ordens (placa);
CREATE INDEX IF NOT EXISTS ordens_host_idx ON public.ordens (host);
CREATE INDEX IF NOT EXISTS ordens_locadora_idx ON public.ordens (locadora_id);

-- Locadora cria as próprias solicitações
CREATE POLICY "locadora cria ordens" ON public.ordens
  FOR INSERT TO authenticated
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));

CREATE POLICY "locadora importa" ON public.importacoes
  FOR INSERT TO authenticated
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));

-- 2. Apelidos de locadora (reconhecimento automático)
CREATE TABLE IF NOT EXISTS public.locadora_apelidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  apelido text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS locadora_apelidos_unico ON public.locadora_apelidos (lower(apelido));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locadora_apelidos TO authenticated;
GRANT ALL ON public.locadora_apelidos TO service_role;
ALTER TABLE public.locadora_apelidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apelidos visiveis" ON public.locadora_apelidos
  FOR SELECT TO authenticated
  USING (public.equipe(auth.uid()) OR locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "equipe cria apelidos" ON public.locadora_apelidos
  FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe atualiza apelidos" ON public.locadora_apelidos
  FOR UPDATE TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe apaga apelidos" ON public.locadora_apelidos
  FOR DELETE TO authenticated USING (public.equipe(auth.uid()));

-- 3. Evidências da ordem
CREATE TABLE IF NOT EXISTS public.ordem_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.ordens(id) ON DELETE CASCADE,
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  agente_id uuid REFERENCES public.agentes(id) ON DELETE SET NULL,
  usuario_id uuid,
  tipo text NOT NULL DEFAULT 'foto',
  etapa text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  caminho text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT '',
  tamanho bigint NOT NULL DEFAULT 0,
  gps text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ordem_evidencias_ordem_idx ON public.ordem_evidencias (ordem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_evidencias TO authenticated;
GRANT ALL ON public.ordem_evidencias TO service_role;
ALTER TABLE public.ordem_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidencias visiveis" ON public.ordem_evidencias
  FOR SELECT TO authenticated
  USING (
    public.equipe(auth.uid())
    OR locadora_id = public.locadora_do_usuario(auth.uid())
    OR agente_id = public.agente_do_usuario(auth.uid())
  );
CREATE POLICY "envia evidencias" ON public.ordem_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens o
      WHERE o.id = ordem_evidencias.ordem_id
        AND o.locadora_id = ordem_evidencias.locadora_id
        AND (public.equipe(auth.uid()) OR o.agente_id = public.agente_do_usuario(auth.uid()))
    )
  );
CREATE POLICY "equipe apaga evidencias" ON public.ordem_evidencias
  FOR DELETE TO authenticated USING (public.equipe(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ordem_evidencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locadora_apelidos;