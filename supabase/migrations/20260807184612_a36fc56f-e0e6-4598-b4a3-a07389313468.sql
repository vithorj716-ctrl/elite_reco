-- 1. Novos tipos de serviço da operação real
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'coleta_padrao';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'coleta_externa';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'viagem_especial';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'limpeza_moto';
ALTER TYPE public.tipo_servico ADD VALUE IF NOT EXISTS 'escapamento';

-- 2. Ordens: dupla de agentes, valores individuais, km e aceite
ALTER TABLE public.ordens
  ADD COLUMN IF NOT EXISTS agente_auxiliar_id uuid REFERENCES public.agentes(id),
  ADD COLUMN IF NOT EXISTS valor_pagamento_principal numeric,
  ADD COLUMN IF NOT EXISTS valor_pagamento_auxiliar numeric,
  ADD COLUMN IF NOT EXISTS quantidade_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aceita_em timestamptz;

-- 3. Itens de remuneração: unidade fixa ou por quilômetro
ALTER TABLE public.itens_remuneracao
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'fixo';

-- 4. Lançamentos: situação gerenciável (ativo / cancelado / estornado)
ALTER TABLE public.lancamentos_agente
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS motivo text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "equipe altera lancamentos" ON public.lancamentos_agente;
CREATE POLICY "equipe altera lancamentos" ON public.lancamentos_agente
  FOR UPDATE TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));

DROP POLICY IF EXISTS "equipe exclui lancamentos" ON public.lancamentos_agente;
CREATE POLICY "equipe exclui lancamentos" ON public.lancamentos_agente
  FOR DELETE TO authenticated
  USING (public.equipe(auth.uid()));

-- 5. Regras da ordem: dupla de agentes + travas do fluxo de campo
CREATE OR REPLACE FUNCTION public.ordens_regras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipe boolean := public.equipe(auth.uid());
  v_cliente boolean;
  v_liquidada boolean;
  v_conclusao boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_equipe THEN
      NEW.status := 'pendente';
      NEW.agente_id := NULL;
      NEW.agente_auxiliar_id := NULL;
      NEW.recebimento_pago := false;
      NEW.pagamento_pago := false;
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
      NEW.valor_pagamento_principal := NULL;
      NEW.valor_pagamento_auxiliar := NULL;
      NEW.distribuida_em := NULL;
      NEW.aceita_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
    END IF;
    IF NEW.agente_auxiliar_id IS NOT NULL AND NEW.agente_auxiliar_id = NEW.agente_id THEN
      RAISE EXCEPTION 'O agente auxiliar precisa ser diferente do agente principal';
    END IF;
    IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
      NEW.codigo := 'OS-' || lpad(nextval('public.ordens_codigo_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.agente_auxiliar_id IS NOT NULL AND NEW.agente_auxiliar_id = NEW.agente_id THEN
    RAISE EXCEPTION 'O agente auxiliar precisa ser diferente do agente principal';
  END IF;

  v_liquidada := OLD.recebimento_pago OR OLD.pagamento_pago;
  v_conclusao := OLD.status = 'em_andamento' AND NEW.status = 'concluida';
  v_cliente := NOT v_equipe AND OLD.locadora_id = public.locadora_do_usuario(auth.uid());

  IF v_cliente THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelada' THEN
      RAISE EXCEPTION 'A locadora só pode cancelar a própria solicitação';
    END IF;
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.agente_auxiliar_id IS DISTINCT FROM OLD.agente_auxiliar_id
       OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
       OR NEW.valor_pagamento_principal IS DISTINCT FROM OLD.valor_pagamento_principal
       OR NEW.valor_pagamento_auxiliar IS DISTINCT FROM OLD.valor_pagamento_auxiliar
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'A locadora não pode alterar dados financeiros ou de distribuição da ordem';
    END IF;
  ELSIF NOT v_equipe THEN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.agente_auxiliar_id IS DISTINCT FROM OLD.agente_auxiliar_id
       OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
       OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'Agente não pode alterar dados cadastrais ou financeiros da ordem';
    END IF;

    IF NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
       OR NEW.valor_pagamento_principal IS DISTINCT FROM OLD.valor_pagamento_principal
       OR NEW.valor_pagamento_auxiliar IS DISTINCT FROM OLD.valor_pagamento_auxiliar THEN
      IF v_conclusao AND OLD.valor_cobranca IS NULL AND OLD.valor_pagamento IS NULL THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Agente não pode alterar valores da ordem';
      END IF;
    END IF;

    IF NEW.status NOT IN ('em_andamento','concluida') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Agente só pode avançar a ordem no fluxo de campo';
    END IF;
  END IF;

  IF v_liquidada THEN
    IF (NEW.recebimento_pago OR NEW.pagamento_pago)
       AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
            OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
            OR NEW.valor_pagamento_principal IS DISTINCT FROM OLD.valor_pagamento_principal
            OR NEW.valor_pagamento_auxiliar IS DISTINCT FROM OLD.valor_pagamento_auxiliar
            OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
            OR NEW.agente_auxiliar_id IS DISTINCT FROM OLD.agente_auxiliar_id
            OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
            OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
            OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico) THEN
      RAISE EXCEPTION 'Ordem já faturada ou paga. Estorne a liquidação antes de alterá-la.';
    END IF;
  END IF;

  IF (NEW.recebimento_pago AND NOT OLD.recebimento_pago AND NEW.status <> 'concluida')
     OR (NEW.pagamento_pago AND NOT OLD.pagamento_pago AND NEW.status <> 'concluida') THEN
    RAISE EXCEPTION 'Só é possível liquidar uma ordem concluída';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pendente'     AND NEW.status IN ('distribuida','cancelada'))
      OR (OLD.status = 'distribuida'  AND NEW.status IN ('em_andamento','pendente','cancelada'))
      OR (OLD.status = 'em_andamento' AND NEW.status IN ('concluida','pendente','cancelada'))
      OR (OLD.status = 'concluida'    AND NEW.status = 'pendente')
      OR (OLD.status = 'cancelada'    AND NEW.status = 'pendente')
    ) THEN
      RAISE EXCEPTION 'Transição de situação inválida: % para %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'distribuida' THEN
      IF NEW.agente_id IS NULL THEN
        RAISE EXCEPTION 'Ordem distribuída precisa de um agente principal';
      END IF;
      NEW.distribuida_em := COALESCE(NEW.distribuida_em, now());
      NEW.aceita_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
    ELSIF NEW.status = 'em_andamento' THEN
      NEW.aceita_em := COALESCE(NEW.aceita_em, now());
      NEW.iniciada_em := COALESCE(NEW.iniciada_em, now());
    ELSIF NEW.status = 'concluida' THEN
      IF NEW.iniciada_em IS NULL THEN
        RAISE EXCEPTION 'Não é possível concluir uma ordem que não foi iniciada em campo';
      END IF;
      IF NEW.chegada_em IS NULL THEN
        RAISE EXCEPTION 'Antes de continuar é necessário informar sua chegada ao local';
      END IF;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSIF NEW.status = 'cancelada' THEN
      NEW.cancelada_em := now();
    ELSIF NEW.status = 'pendente' THEN
      NEW.agente_id := NULL;
      NEW.agente_auxiliar_id := NULL;
      NEW.distribuida_em := NULL;
      NEW.aceita_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
      NEW.valor_pagamento_principal := NULL;
      NEW.valor_pagamento_auxiliar := NULL;
    END IF;
  END IF;

  -- Chegada só pode ser anunciada depois de iniciado o deslocamento
  IF NEW.chegada_em IS NOT NULL AND OLD.chegada_em IS NULL AND NEW.iniciada_em IS NULL THEN
    RAISE EXCEPTION 'Para anunciar a chegada é obrigatório iniciar o deslocamento';
  END IF;

  RETURN NEW;
END;
$function$;

-- 6. Evidências só depois da chegada anunciada (quando enviadas pelo agente)
CREATE OR REPLACE FUNCTION public.evidencias_exigem_chegada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem public.ordens%ROWTYPE;
BEGIN
  IF public.equipe(auth.uid()) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_ordem FROM public.ordens WHERE id = NEW.ordem_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF v_ordem.agente_id IS NOT NULL
     AND v_ordem.agente_id = public.agente_do_usuario(auth.uid())
     AND v_ordem.chegada_em IS NULL THEN
    RAISE EXCEPTION 'Antes de continuar é necessário informar sua chegada ao local';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS evidencias_exigem_chegada_trg ON public.ordem_evidencias;
CREATE TRIGGER evidencias_exigem_chegada_trg
  BEFORE INSERT ON public.ordem_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.evidencias_exigem_chegada();

-- 7. Herança automática da tabela padrão de cobrança para novas locadoras
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
    (tabela_id, codigo, nome, descricao, valor, status, observacao, ativo, posicao, unidade)
  SELECT v_nova, codigo, nome, descricao, valor, status, observacao, ativo, posicao, unidade
    FROM public.itens_remuneracao WHERE tabela_id = v_padrao;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS locadora_herda_tabela_trg ON public.locadoras;
CREATE TRIGGER locadora_herda_tabela_trg
  AFTER INSERT ON public.locadoras
  FOR EACH ROW EXECUTE FUNCTION public.locadora_herda_tabela();

-- 8. Duas tabelas padrão com os serviços iniciais da operação
DO $seed$
DECLARE
  v_cob uuid;
  v_pag uuid;
BEGIN
  SELECT id INTO v_cob FROM public.tabelas_remuneracao
   WHERE escopo = 'cobranca' AND padrao AND locadora_id IS NULL AND agente_id IS NULL LIMIT 1;
  IF v_cob IS NULL THEN
    INSERT INTO public.tabelas_remuneracao (nome, escopo, padrao, ativa, observacao)
    VALUES ('Tabela Padrão de Cobrança da Locadora', 'cobranca', true, true,
            'Base de cobrança herdada por toda nova locadora.')
    RETURNING id INTO v_cob;

    INSERT INTO public.itens_remuneracao (tabela_id, codigo, nome, descricao, valor, unidade, posicao)
    VALUES
      (v_cob, 'coleta_padrao',   'Coleta Padrão',   'Recolhimento comum na região de atuação.', 100, 'fixo', 1),
      (v_cob, 'coleta_externa',  'Coleta Externa',  'Recolhimento em cidade distante da região principal.', 200, 'fixo', 2),
      (v_cob, 'viagem_especial', 'Viagem Especial', 'Cobrança por quilômetro percorrido.', 3.50, 'km', 3),
      (v_cob, 'limpeza_moto',    'Limpeza da Moto', 'Higienização da motocicleta recolhida.', 0, 'fixo', 4),
      (v_cob, 'escapamento',     'Escapamento',     'Serviço referente ao escapamento.', 0, 'fixo', 5);
  END IF;

  SELECT id INTO v_pag FROM public.tabelas_remuneracao
   WHERE escopo = 'pagamento' AND padrao AND locadora_id IS NULL AND agente_id IS NULL LIMIT 1;
  IF v_pag IS NULL THEN
    INSERT INTO public.tabelas_remuneracao (nome, escopo, padrao, ativa, observacao)
    VALUES ('Tabela Padrão de Pagamento dos Agentes', 'pagamento', true, true,
            'Base de pagamento usada por todos os agentes.')
    RETURNING id INTO v_pag;

    INSERT INTO public.itens_remuneracao (tabela_id, codigo, nome, descricao, valor, unidade, posicao)
    VALUES
      (v_pag, 'coleta_padrao',   'Coleta Padrão',   'Repasse da dupla na coleta comum.', 60, 'fixo', 1),
      (v_pag, 'coleta_externa',  'Coleta Externa',  'Repasse da dupla na coleta distante.', 120, 'fixo', 2),
      (v_pag, 'viagem_especial', 'Viagem Especial', 'Repasse por quilômetro percorrido.', 2.00, 'km', 3),
      (v_pag, 'limpeza_moto',    'Limpeza da Moto', 'Repasse pela limpeza da motocicleta.', 0, 'fixo', 4),
      (v_pag, 'escapamento',     'Escapamento',     'Repasse referente ao escapamento.', 0, 'fixo', 5);
  END IF;
END;
$seed$;