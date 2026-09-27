-- 1. Catálogo de serviços
CREATE TABLE public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  unidade text NOT NULL DEFAULT 'fixo',
  ativo boolean NOT NULL DEFAULT true,
  posicao integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "servicos_leitura" ON public.servicos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "servicos_insere" ON public.servicos
  FOR INSERT TO authenticated WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "servicos_atualiza" ON public.servicos
  FOR UPDATE TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "servicos_exclui" ON public.servicos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER servicos_atualizado BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

-- 2. Serviços oficiais
INSERT INTO public.servicos (codigo, nome, descricao, unidade, ativo, posicao) VALUES
  ('coleta_padrao',   'Coleta Padrão',   'Recolhimento dentro da região principal de atendimento.', 'fixo', true, 1),
  ('coleta_externa',  'Coleta Externa',  'Operação fora da região principal de atendimento.',       'fixo', true, 2),
  ('viagem_especial', 'Viagem Especial', 'Deslocamento cobrado por quilômetro percorrido.',          'km',   true, 3),
  ('limpeza_moto',    'Limpeza da Moto', 'Higienização da motocicleta recolhida.',                   'fixo', true, 4),
  ('escapamento',     'Escapamento',     'Serviço de escapamento.',                                  'fixo', true, 5);

-- Serviços legados: preservam o histórico, mas não aparecem em novas seleções
INSERT INTO public.servicos (codigo, nome, descricao, unidade, ativo, posicao)
SELECT DISTINCT o.tipo_servico::text,
       initcap(replace(o.tipo_servico::text, '_', ' ')),
       'Serviço legado mantido apenas para o histórico.',
       'fixo', false, 90
  FROM public.ordens o
 WHERE o.tipo_servico::text NOT IN (SELECT codigo FROM public.servicos);

INSERT INTO public.servicos (codigo, nome, descricao, unidade, ativo, posicao)
SELECT DISTINCT i.codigo,
       initcap(replace(i.codigo, '_', ' ')),
       'Serviço legado mantido apenas para o histórico.',
       'fixo', false, 91
  FROM public.itens_remuneracao i
 WHERE i.codigo NOT IN (SELECT codigo FROM public.servicos);

-- 3. Itens da tabela referenciam o serviço
ALTER TABLE public.itens_remuneracao
  ADD COLUMN servico_id uuid REFERENCES public.servicos(id) ON DELETE RESTRICT;

UPDATE public.itens_remuneracao i
   SET servico_id = s.id
  FROM public.servicos s
 WHERE s.codigo = i.codigo AND i.servico_id IS NULL;

CREATE INDEX itens_remuneracao_servico_idx ON public.itens_remuneracao (servico_id);

-- 4. Ordens referenciam o serviço
ALTER TABLE public.ordens
  ADD COLUMN servico_id uuid REFERENCES public.servicos(id) ON DELETE RESTRICT;

UPDATE public.ordens o
   SET servico_id = s.id
  FROM public.servicos s
 WHERE s.codigo = o.tipo_servico::text AND o.servico_id IS NULL;

CREATE INDEX ordens_servico_idx ON public.ordens (servico_id);

-- 5. Locadora referencia a tabela de cobrança utilizada
ALTER TABLE public.locadoras
  ADD COLUMN tabela_cobranca_id uuid REFERENCES public.tabelas_remuneracao(id) ON DELETE SET NULL;

UPDATE public.locadoras l
   SET tabela_cobranca_id = t.id
  FROM public.tabelas_remuneracao t
 WHERE t.escopo = 'cobranca' AND t.ativa AND t.locadora_id = l.id
   AND l.tabela_cobranca_id IS NULL;

UPDATE public.locadoras l
   SET tabela_cobranca_id = (
     SELECT t.id FROM public.tabelas_remuneracao t
      WHERE t.escopo = 'cobranca' AND t.padrao AND t.locadora_id IS NULL AND t.agente_id IS NULL
      ORDER BY t.criado_em LIMIT 1)
 WHERE l.tabela_cobranca_id IS NULL;

-- 6. Herança passa a gravar a referência e copiar o serviço
CREATE OR REPLACE FUNCTION public.locadora_herda_tabela()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_padrao uuid;
  v_nova uuid;
BEGIN
  SELECT id INTO v_padrao FROM public.tabelas_remuneracao
   WHERE escopo = 'cobranca' AND padrao AND locadora_id IS NULL AND agente_id IS NULL
   ORDER BY criado_em LIMIT 1;
  IF v_padrao IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tabelas_remuneracao (nome, escopo, locadora_id, padrao, ativa, observacao)
  VALUES ('Cobrança — ' || NEW.nome, 'cobranca', NEW.id, false, true,
          'Herdada da tabela padrão de cobrança.')
  RETURNING id INTO v_nova;

  INSERT INTO public.itens_remuneracao
    (tabela_id, codigo, servico_id, nome, descricao, valor, status, observacao, ativo, posicao, unidade)
  SELECT v_nova, codigo, servico_id, nome, descricao, valor, status, observacao, ativo, posicao, unidade
    FROM public.itens_remuneracao WHERE tabela_id = v_padrao;

  UPDATE public.locadoras SET tabela_cobranca_id = v_nova WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;