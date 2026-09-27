-- 1. Novos tipos de serviço
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'recolhimento_urbano';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'recolhimento_rural';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'tentativa_sem_sucesso';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'moto_patio';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'entrega';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'remocao_especial';

-- 2. Locadoras: dados públicos (BrasilAPI) + comerciais
ALTER TABLE public.locadoras
  ADD COLUMN IF NOT EXISTS razao_social text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_fantasia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS situacao_cadastral text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_abertura text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS natureza_juridica text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnae text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rua text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS limite_credito numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prazo_pagamento integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes text NOT NULL DEFAULT '';

-- 3. Agentes: ficha completa
ALTER TABLE public.agentes
  ADD COLUMN IF NOT EXISTS cpf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rg text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nascimento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sexo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado_civil text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rua text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnh text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnh_categoria text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnh_validade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contratado_em text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS regiao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cidades_atendidas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moto_placa text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS moto_modelo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS moto_ano text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS moto_cor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS moto_renavam text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seguro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS observacoes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS foto text NOT NULL DEFAULT '';

-- 4. Documentos do agente
CREATE TABLE IF NOT EXISTS public.agente_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  nome text NOT NULL,
  url text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_documentos TO authenticated;
GRANT ALL ON public.agente_documentos TO service_role;
ALTER TABLE public.agente_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos visiveis" ON public.agente_documentos
  FOR SELECT TO authenticated
  USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

CREATE POLICY "equipe cria documentos" ON public.agente_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

CREATE POLICY "equipe atualiza documentos" ON public.agente_documentos
  FOR UPDATE TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));

CREATE POLICY "equipe apaga documentos" ON public.agente_documentos
  FOR DELETE TO authenticated
  USING (public.equipe(auth.uid()));

-- 5. Pagamentos aos agentes
CREATE TABLE IF NOT EXISTS public.pagamentos_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  forma text NOT NULL DEFAULT 'pix',
  observacao text NOT NULL DEFAULT '',
  comprovante text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pagamentos_agente TO authenticated;
GRANT ALL ON public.pagamentos_agente TO service_role;
ALTER TABLE public.pagamentos_agente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos visiveis" ON public.pagamentos_agente
  FOR SELECT TO authenticated
  USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

CREATE POLICY "equipe registra pagamentos" ON public.pagamentos_agente
  FOR INSERT TO authenticated
  WITH CHECK (public.equipe(auth.uid()));

-- 6. Tabela de preços: chave única para upsert por escopo
CREATE UNIQUE INDEX IF NOT EXISTS precos_escopo_ref_servico_idx
  ON public.precos (escopo, referencia_id, tipo_servico);

-- 7. Realtime
ALTER TABLE public.agente_documentos REPLICA IDENTITY FULL;
ALTER TABLE public.pagamentos_agente REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agente_documentos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_agente;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;