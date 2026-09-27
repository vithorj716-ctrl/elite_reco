-- ============ Tipos ============
DO $$ BEGIN
  CREATE TYPE public.distribuicao_tipo AS ENUM ('vistoria','recolhimento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribuicao_status AS ENUM
    ('aguardando_distribuicao','distribuida','notificada','aceita','recusada',
     'em_execucao','concluida','cancelada','redistribuida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribuicao_origem AS ENUM ('automatica','manual','redistribuida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Colunas novas em vistorias ============
ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS agente_auxiliar_id uuid REFERENCES public.agentes(id),
  ADD COLUMN IF NOT EXISTS valor_pagamento_principal numeric,
  ADD COLUMN IF NOT EXISTS valor_pagamento_auxiliar numeric;

-- ============ Tabelas ============
CREATE TABLE IF NOT EXISTS public.distribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.distribuicao_tipo NOT NULL,
  ordem_id uuid REFERENCES public.ordens(id) ON DELETE CASCADE,
  vistoria_id uuid REFERENCES public.vistorias(id) ON DELETE CASCADE,
  moto_id uuid REFERENCES public.motos(id) ON DELETE CASCADE,
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id),
  gatilho text NOT NULL DEFAULT 'moto_cadastrada',
  servico_id uuid REFERENCES public.servicos(id),
  servico_nome text NOT NULL DEFAULT '',
  valor_cobranca numeric NOT NULL DEFAULT 0,
  valor_pagamento numeric NOT NULL DEFAULT 0,
  agente_id uuid REFERENCES public.agentes(id),
  agente_auxiliar_id uuid REFERENCES public.agentes(id),
  status public.distribuicao_status NOT NULL DEFAULT 'aguardando_distribuicao',
  origem public.distribuicao_origem NOT NULL DEFAULT 'automatica',
  regra text NOT NULL DEFAULT '',
  elegiveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  descartados jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo text NOT NULL DEFAULT '',
  distribuida_em timestamptz,
  notificada_em timestamptz,
  aceita_em timestamptz,
  recusada_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS distribuicoes_evento_unico
  ON public.distribuicoes (moto_id, gatilho, tipo) WHERE moto_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS distribuicoes_ordem_unica
  ON public.distribuicoes (ordem_id) WHERE ordem_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS distribuicoes_vistoria_unica
  ON public.distribuicoes (vistoria_id) WHERE vistoria_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.distribuicao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuicao_id uuid NOT NULL REFERENCES public.distribuicoes(id) ON DELETE CASCADE,
  acao text NOT NULL,
  detalhe text NOT NULL DEFAULT '',
  automatico boolean NOT NULL DEFAULT true,
  quem uuid,
  quem_nome text NOT NULL DEFAULT 'Sistema',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  quando timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS distribuicao_eventos_idx ON public.distribuicao_eventos (distribuicao_id, quando);

CREATE TABLE IF NOT EXISTS public.distribuicao_recusas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuicao_id uuid NOT NULL REFERENCES public.distribuicoes(id) ON DELETE CASCADE,
  agente_id uuid NOT NULL REFERENCES public.agentes(id),
  motivo text NOT NULL DEFAULT '',
  recusada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribuicao_id, agente_id)
);

GRANT SELECT ON public.distribuicoes TO authenticated;
GRANT SELECT ON public.distribuicao_eventos TO authenticated;
GRANT SELECT ON public.distribuicao_recusas TO authenticated;
GRANT ALL ON public.distribuicoes TO service_role;
GRANT ALL ON public.distribuicao_eventos TO service_role;
GRANT ALL ON public.distribuicao_recusas TO service_role;

ALTER TABLE public.distribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_recusas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distribuicoes visiveis" ON public.distribuicoes;
CREATE POLICY "distribuicoes visiveis" ON public.distribuicoes FOR SELECT TO authenticated
USING (
  public.equipe(auth.uid())
  OR locadora_id = public.locadora_do_usuario(auth.uid())
  OR agente_id = public.agente_do_usuario(auth.uid())
  OR agente_auxiliar_id = public.agente_do_usuario(auth.uid())
);

DROP POLICY IF EXISTS "eventos visiveis" ON public.distribuicao_eventos;
CREATE POLICY "eventos visiveis" ON public.distribuicao_eventos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.distribuicoes d WHERE d.id = distribuicao_id));

DROP POLICY IF EXISTS "recusas visiveis" ON public.distribuicao_recusas;
CREATE POLICY "recusas visiveis" ON public.distribuicao_recusas FOR SELECT TO authenticated
USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

-- ============ Modo distribuição (bypass controlado das travas) ============
CREATE OR REPLACE FUNCTION public.modo_distribuicao()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.distribuicao', true), '') = '1'
$$;

-- ============ Preço a partir das tabelas do administrador ============
CREATE OR REPLACE FUNCTION public.valor_tabela_servico(_locadora uuid, _servico uuid, _escopo text)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tabela uuid; v_valor numeric;
BEGIN
  IF _escopo = 'cobranca' THEN
    SELECT tabela_cobranca_id INTO v_tabela FROM public.locadoras WHERE id = _locadora;
  ELSE
    SELECT id INTO v_tabela FROM public.tabelas_remuneracao
     WHERE escopo = _escopo AND ativa AND locadora_id = _locadora ORDER BY criado_em LIMIT 1;
  END IF;

  IF v_tabela IS NOT NULL THEN
    SELECT valor INTO v_valor FROM public.itens_remuneracao
     WHERE tabela_id = v_tabela AND servico_id = _servico AND ativo ORDER BY posicao LIMIT 1;
  END IF;

  IF v_valor IS NULL THEN
    SELECT id INTO v_tabela FROM public.tabelas_remuneracao
     WHERE escopo = _escopo AND ativa AND padrao AND locadora_id IS NULL AND agente_id IS NULL
     ORDER BY criado_em LIMIT 1;
    IF v_tabela IS NOT NULL THEN
      SELECT valor INTO v_valor FROM public.itens_remuneracao
       WHERE tabela_id = v_tabela AND servico_id = _servico AND ativo ORDER BY posicao LIMIT 1;
    END IF;
  END IF;

  RETURN coalesce(v_valor, 0);
END; $$;

-- ============ Registro de eventos ============
CREATE OR REPLACE FUNCTION public.registrar_evento_distribuicao(
  _dist uuid, _acao text, _detalhe text, _automatico boolean, _dados jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.distribuicao_eventos (distribuicao_id, acao, detalhe, automatico, quem, quem_nome, dados)
  VALUES (_dist, _acao, coalesce(_detalhe,''), _automatico, auth.uid(),
          CASE WHEN _automatico THEN 'Sistema' ELSE coalesce(v_nome, 'Administrador') END,
          coalesce(_dados, '{}'::jsonb));
  INSERT INTO public.auditoria (entidade, registro_id, acao, quem, quem_nome, dados)
  VALUES ('distribuicoes', _dist, _acao, auth.uid(),
          CASE WHEN _automatico THEN 'Sistema' ELSE coalesce(v_nome, 'Administrador') END,
          coalesce(_dados, '{}'::jsonb) || jsonb_build_object('detalhe', coalesce(_detalhe,''), 'automatico', _automatico));
END; $$;

-- ============ Sorteio do agente ============
CREATE OR REPLACE FUNCTION public.sortear_agente_distribuicao(
  _dist uuid, _origem public.distribuicao_origem DEFAULT 'automatica', _forcado uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  d public.distribuicoes%ROWTYPE;
  v_cidade text;
  v_escolhido uuid;
  v_elegiveis jsonb := '[]'::jsonb;
  v_descartados jsonb := '[]'::jsonb;
  v_resumo text;
  v_regra text;
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;

  SELECT cidade INTO v_cidade FROM public.locadoras WHERE id = d.locadora_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'cidade', a.cidade)), '[]'::jsonb)
    INTO v_elegiveis
    FROM public.agentes a
   WHERE a.ativo AND a.situacao = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
     AND a.id IS DISTINCT FROM d.agente_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'motivo',
           CASE WHEN NOT a.ativo THEN 'inativo'
                WHEN a.situacao <> 'ativo' THEN 'situação ' || a.situacao
                WHEN EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id) THEN 'recusou esta operação'
                ELSE 'agente atual' END)), '[]'::jsonb)
    INTO v_descartados
    FROM public.agentes a
   WHERE NOT (a.ativo AND a.situacao = 'ativo'
              AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
              AND a.id IS DISTINCT FROM d.agente_id);

  IF _forcado IS NOT NULL THEN
    v_escolhido := _forcado;
    v_regra := 'Agente definido manualmente pelo administrador';
  ELSE
    -- preferência por quem atende a cidade da locadora
    SELECT a.id INTO v_escolhido
      FROM public.agentes a
     WHERE a.ativo AND a.situacao = 'ativo'
       AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
       AND a.id IS DISTINCT FROM d.agente_id
       AND v_cidade <> '' AND (lower(a.cidade) = lower(v_cidade) OR v_cidade = ANY (a.cidades_atendidas))
     ORDER BY random() LIMIT 1;
    v_regra := 'Sorteio entre agentes ativos que atendem ' || coalesce(nullif(v_cidade,''), 'a região');

    IF v_escolhido IS NULL THEN
      SELECT a.id INTO v_escolhido
        FROM public.agentes a
       WHERE a.ativo AND a.situacao = 'ativo'
         AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
         AND a.id IS DISTINCT FROM d.agente_id
       ORDER BY random() LIMIT 1;
      v_regra := 'Sorteio entre todos os agentes ativos';
    END IF;
  END IF;

  UPDATE public.distribuicoes
     SET elegiveis = v_elegiveis, descartados = v_descartados, regra = v_regra,
         origem = _origem, atualizado_em = now()
   WHERE id = _dist;

  IF v_escolhido IS NULL THEN
    UPDATE public.distribuicoes SET status = 'aguardando_distribuicao', agente_id = NULL WHERE id = _dist;
    PERFORM public.registrar_evento_distribuicao(_dist, 'Sem agente elegível',
      'Nenhum agente disponível para o sorteio', true, jsonb_build_object('descartados', v_descartados));
    PERFORM public.notificar_equipe('operacional', 'Operação aguardando distribuição',
      'Nenhum agente elegível foi encontrado para uma operação nova.', NULL);
    RETURN NULL;
  END IF;

  UPDATE public.distribuicoes
     SET agente_id = v_escolhido, status = 'notificada', distribuida_em = now(),
         notificada_em = now(), aceita_em = NULL, recusada_em = NULL
   WHERE id = _dist;

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET agente_id = v_escolhido, status = 'distribuida', aceita_em = NULL
     WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET agente_id = v_escolhido, status = 'distribuida', aceita_em = NULL
     WHERE id = d.vistoria_id;
  END IF;

  v_resumo := d.servico_nome || ' • ' || coalesce((SELECT placa FROM public.motos WHERE id = d.moto_id), '');

  PERFORM public.registrar_evento_distribuicao(_dist,
    CASE WHEN _forcado IS NULL THEN 'Agente sorteado automaticamente' ELSE 'Agente definido pelo administrador' END,
    coalesce((SELECT nome FROM public.agentes WHERE id = v_escolhido), '') || ' — ' || v_regra,
    _forcado IS NULL,
    jsonb_build_object('agente_id', v_escolhido, 'elegiveis', v_elegiveis, 'descartados', v_descartados));

  PERFORM public.registrar_evento_distribuicao(_dist, 'Notificação enviada', v_resumo, true,
    jsonb_build_object('agente_id', v_escolhido));

  IF d.tipo = 'recolhimento' THEN
    PERFORM public.notificar_agente(v_escolhido, 'nova_ordem', 'Nova operação disponível', v_resumo, d.ordem_id);
  ELSE
    PERFORM public.notificar_agente_vistoria(v_escolhido, 'nova_ordem', 'Nova operação disponível', v_resumo, d.vistoria_id);
  END IF;

  RETURN v_escolhido;
END; $$;

-- ============ Gatilho: moto cadastrada gera vistoria + recolhimento ============
CREATE OR REPLACE FUNCTION public.distribuir_moto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_serv_vist uuid; v_serv_col uuid;
  v_nome_vist text; v_nome_col text;
  v_vistoria uuid; v_ordem uuid; v_dist uuid;
  v_cobranca numeric; v_pagamento numeric;
  v_loc public.locadoras%ROWTYPE;
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO v_loc FROM public.locadoras WHERE id = NEW.locadora_id;
  IF NEW.situacao <> 'ativa' THEN RETURN NEW; END IF;

  SELECT id, nome INTO v_serv_vist, v_nome_vist FROM public.servicos WHERE codigo = 'vistoria_moto' AND ativo;
  SELECT id, nome INTO v_serv_col,  v_nome_col  FROM public.servicos WHERE codigo = 'coleta_padrao'  AND ativo;

  -- VISTORIA
  IF v_serv_vist IS NOT NULL THEN
    INSERT INTO public.vistorias (moto_id, locadora_id, servico_id, origem, status,
      endereco, bairro, cidade, uf, cep, host, pin)
    VALUES (NEW.id, NEW.locadora_id, v_serv_vist, 'automatica', 'pendente',
      v_loc.rua, v_loc.bairro, v_loc.cidade, v_loc.uf, v_loc.cep, NEW.host, NEW.pin)
    RETURNING id INTO v_vistoria;

    v_cobranca := public.valor_tabela_servico(NEW.locadora_id, v_serv_vist, 'cobranca');
    v_pagamento := public.valor_tabela_servico(NEW.locadora_id, v_serv_vist, 'pagamento');

    UPDATE public.vistorias
       SET valor_cobranca = v_cobranca, valor_pagamento = v_pagamento,
           valor_pagamento_principal = v_pagamento
     WHERE id = v_vistoria;

    INSERT INTO public.distribuicoes (tipo, vistoria_id, moto_id, locadora_id, gatilho,
      servico_id, servico_nome, valor_cobranca, valor_pagamento, status, origem)
    VALUES ('vistoria', v_vistoria, NEW.id, NEW.locadora_id, 'moto_cadastrada',
      v_serv_vist, v_nome_vist, v_cobranca, v_pagamento, 'aguardando_distribuicao', 'automatica')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_dist;

    IF v_dist IS NOT NULL THEN
      PERFORM public.registrar_evento_distribuicao(v_dist, 'Operação criada pela locadora',
        v_nome_vist || ' • ' || NEW.placa, true, jsonb_build_object('moto_id', NEW.id));
      PERFORM public.registrar_evento_distribuicao(v_dist, 'Serviço selecionado automaticamente',
        v_nome_vist || ' — R$ ' || to_char(v_cobranca, 'FM999999990.00'), true,
        jsonb_build_object('servico_id', v_serv_vist, 'valor_cobranca', v_cobranca, 'valor_pagamento', v_pagamento));
      PERFORM public.sortear_agente_distribuicao(v_dist, 'automatica', NULL);
    END IF;
  END IF;

  -- RECOLHIMENTO
  IF v_serv_col IS NOT NULL THEN
    INSERT INTO public.ordens (locadora_id, placa, marca, modelo, ano, cor, servico_id,
      endereco, bairro, cidade, uf, cep, host, pin, status, observacoes)
    VALUES (NEW.locadora_id, NEW.placa, NEW.marca, NEW.modelo, NEW.ano, NEW.cor, v_serv_col,
      v_loc.rua, v_loc.bairro, v_loc.cidade, v_loc.uf, v_loc.cep, NEW.host, NEW.pin, 'pendente',
      'Operação criada automaticamente no cadastro da motocicleta.')
    RETURNING id INTO v_ordem;

    v_cobranca := public.valor_tabela_servico(NEW.locadora_id, v_serv_col, 'cobranca');
    v_pagamento := public.valor_tabela_servico(NEW.locadora_id, v_serv_col, 'pagamento');

    UPDATE public.ordens
       SET valor_cobranca = v_cobranca, valor_pagamento = v_pagamento,
           valor_pagamento_principal = v_pagamento
     WHERE id = v_ordem;

    INSERT INTO public.distribuicoes (tipo, ordem_id, moto_id, locadora_id, gatilho,
      servico_id, servico_nome, valor_cobranca, valor_pagamento, status, origem)
    VALUES ('recolhimento', v_ordem, NEW.id, NEW.locadora_id, 'moto_cadastrada',
      v_serv_col, v_nome_col, v_cobranca, v_pagamento, 'aguardando_distribuicao', 'automatica')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_dist;

    IF v_dist IS NOT NULL THEN
      PERFORM public.registrar_evento_distribuicao(v_dist, 'Operação criada pela locadora',
        v_nome_col || ' • ' || NEW.placa, true, jsonb_build_object('moto_id', NEW.id));
      PERFORM public.registrar_evento_distribuicao(v_dist, 'Serviço selecionado automaticamente',
        v_nome_col || ' — R$ ' || to_char(v_cobranca, 'FM999999990.00'), true,
        jsonb_build_object('servico_id', v_serv_col, 'valor_cobranca', v_cobranca, 'valor_pagamento', v_pagamento));
      PERFORM public.sortear_agente_distribuicao(v_dist, 'automatica', NULL);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS distribuir_moto_trg ON public.motos;
CREATE TRIGGER distribuir_moto_trg AFTER INSERT ON public.motos
FOR EACH ROW EXECUTE FUNCTION public.distribuir_moto();