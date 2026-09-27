-- 1. Tabelas de remuneração flexíveis
CREATE TABLE public.tabelas_remuneracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  escopo text NOT NULL CHECK (escopo IN ('cobranca','pagamento')),
  locadora_id uuid REFERENCES public.locadoras(id) ON DELETE CASCADE,
  agente_id uuid REFERENCES public.agentes(id) ON DELETE CASCADE,
  padrao boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  observacao text NOT NULL DEFAULT '',
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabelas_remuneracao TO authenticated;
GRANT ALL ON public.tabelas_remuneracao TO service_role;
ALTER TABLE public.tabelas_remuneracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le tabelas" ON public.tabelas_remuneracao FOR SELECT TO authenticated USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()) OR locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "equipe cria tabelas" ON public.tabelas_remuneracao FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe altera tabelas" ON public.tabelas_remuneracao FOR UPDATE TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe apaga tabelas" ON public.tabelas_remuneracao FOR DELETE TO authenticated USING (public.equipe(auth.uid()));

-- 2. Itens (linhas) das tabelas
CREATE TABLE public.itens_remuneracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.tabelas_remuneracao(id) ON DELETE CASCADE,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'vigente',
  observacao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  posicao integer NOT NULL DEFAULT 0,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX itens_remuneracao_tabela_idx ON public.itens_remuneracao(tabela_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_remuneracao TO authenticated;
GRANT ALL ON public.itens_remuneracao TO service_role;
ALTER TABLE public.itens_remuneracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios leem itens" ON public.itens_remuneracao FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tabelas_remuneracao t WHERE t.id = tabela_id AND (public.equipe(auth.uid()) OR t.agente_id = public.agente_do_usuario(auth.uid()) OR t.locadora_id = public.locadora_do_usuario(auth.uid())))
);
CREATE POLICY "equipe cria itens" ON public.itens_remuneracao FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe altera itens" ON public.itens_remuneracao FOR UPDATE TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe apaga itens" ON public.itens_remuneracao FOR DELETE TO authenticated USING (public.equipe(auth.uid()));

-- 3. Livro-caixa imutável do agente
CREATE TYPE public.tipo_lancamento AS ENUM ('producao','adiantamento','pagamento','desconto','bonificacao','compensacao');

CREATE TABLE public.lancamentos_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  tipo public.tipo_lancamento NOT NULL,
  valor numeric(12,2) NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  descricao text NOT NULL DEFAULT '',
  forma text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  comprovante text NOT NULL DEFAULT '',
  ordem_id uuid REFERENCES public.ordens(id) ON DELETE SET NULL,
  referencia_id uuid,
  responsavel text NOT NULL DEFAULT '',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lancamentos_agente_agente_idx ON public.lancamentos_agente(agente_id, data);
GRANT SELECT, INSERT ON public.lancamentos_agente TO authenticated;
GRANT ALL ON public.lancamentos_agente TO service_role;
ALTER TABLE public.lancamentos_agente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe e agente leem lancamentos" ON public.lancamentos_agente FOR SELECT TO authenticated USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));
CREATE POLICY "equipe cria lancamentos" ON public.lancamentos_agente FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));

-- 4. Configurações editáveis
CREATE TABLE public.configuracoes (
  chave text PRIMARY KEY,
  valor text NOT NULL DEFAULT '',
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados leem configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipe cria configuracoes" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "equipe altera configuracoes" ON public.configuracoes FOR UPDATE TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));

INSERT INTO public.configuracoes (chave, valor) VALUES
  ('recibo_termo', 'Declaro que recebi nesta data o valor acima descrito referente aos serviços prestados de forma autônoma, sem exclusividade, assumindo inteira responsabilidade pelos tributos, encargos e demais obrigações legais decorrentes da atividade exercida, não existindo vínculo empregatício entre as partes.'),
  ('recibo_qrcode', 'sim');

-- 5. Auditoria
CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  registro_id uuid,
  acao text NOT NULL,
  quem uuid,
  quem_nome text NOT NULL DEFAULT '',
  dados jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_entidade_idx ON public.auditoria(entidade, criado_em DESC);
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le auditoria" ON public.auditoria FOR SELECT TO authenticated USING (public.equipe(auth.uid()));
CREATE POLICY "autenticados registram auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Trigger de atualizado_em
CREATE OR REPLACE FUNCTION public.tocar_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

CREATE TRIGGER tabelas_remuneracao_atualizado BEFORE UPDATE ON public.tabelas_remuneracao FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();
CREATE TRIGGER itens_remuneracao_atualizado BEFORE UPDATE ON public.itens_remuneracao FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tabelas_remuneracao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_remuneracao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lancamentos_agente;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes;