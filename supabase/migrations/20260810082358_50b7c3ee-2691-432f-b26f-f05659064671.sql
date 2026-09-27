-- 1. Tipos e situação financeira das cobranças
ALTER TABLE public.ordem_cobrancas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'adicional',
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS estornada_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text NOT NULL DEFAULT '';

ALTER TABLE public.ordem_cobrancas
  DROP CONSTRAINT IF EXISTS ordem_cobrancas_tipo_check;
ALTER TABLE public.ordem_cobrancas
  ADD CONSTRAINT ordem_cobrancas_tipo_check
  CHECK (tipo IN ('servico','taxa_cancelamento','km','adicional','viagem','outros'));

ALTER TABLE public.ordem_cobrancas
  DROP CONSTRAINT IF EXISTS ordem_cobrancas_situacao_check;
ALTER TABLE public.ordem_cobrancas
  ADD CONSTRAINT ordem_cobrancas_situacao_check
  CHECK (situacao IN ('ativa','estornada'));

-- Backfill defensivo (base ainda sem registros, mas mantém idempotência)
UPDATE public.ordem_cobrancas
   SET tipo = 'taxa_cancelamento'
 WHERE tipo = 'adicional' AND nome ILIKE 'taxa de cancelamento%';

-- 2. Uma única taxa de cancelamento por ordem
CREATE UNIQUE INDEX IF NOT EXISTS ordem_cobrancas_taxa_unica
  ON public.ordem_cobrancas (ordem_id)
  WHERE tipo = 'taxa_cancelamento';

CREATE INDEX IF NOT EXISTS ordem_cobrancas_locadora_situacao_idx
  ON public.ordem_cobrancas (locadora_id, situacao);

-- 3. Regras de integridade das cobranças
CREATE OR REPLACE FUNCTION public.cobrancas_regras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem public.ordens%ROWTYPE;
BEGIN
  SELECT * INTO v_ordem FROM public.ordens
   WHERE id = COALESCE(NEW.ordem_id, OLD.ordem_id);
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo = 'taxa_cancelamento' THEN
      RAISE EXCEPTION 'A taxa de cancelamento não pode ser excluída: use o estorno para preservar o histórico';
    END IF;
    IF v_ordem.recebimento_pago THEN
      RAISE EXCEPTION 'Ordem já faturada: as cobranças estão bloqueadas';
    END IF;
    RETURN OLD;
  END IF;

  IF v_ordem.recebimento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada: as cobranças estão bloqueadas';
  END IF;

  NEW.locadora_id := v_ordem.locadora_id;

  IF TG_OP = 'INSERT' THEN
    IF v_ordem.status = 'cancelada' AND NEW.tipo <> 'taxa_cancelamento' THEN
      RAISE EXCEPTION 'Não é possível lançar cobrança em ordem cancelada';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.tipo = 'taxa_cancelamento'
     AND (NEW.valor IS DISTINCT FROM OLD.valor OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN
    RAISE EXCEPTION 'O valor da taxa de cancelamento é imutável: só é possível estorná-la';
  END IF;

  IF OLD.situacao = 'estornada' AND NEW.situacao = 'estornada'
     AND (NEW.valor IS DISTINCT FROM OLD.valor OR NEW.nome IS DISTINCT FROM OLD.nome) THEN
    RAISE EXCEPTION 'Cobrança estornada não pode ser alterada';
  END IF;

  IF NEW.situacao = 'estornada' AND OLD.situacao = 'ativa' THEN
    NEW.estornada_em := COALESCE(NEW.estornada_em, now());
  END IF;

  IF NEW.situacao = 'ativa' AND OLD.situacao = 'estornada' THEN
    NEW.estornada_em := NULL;
    NEW.estornada_por := NULL;
    NEW.motivo_estorno := '';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Ordem cancelada com cobrança ativa pode ser faturada/recebida
CREATE OR REPLACE FUNCTION public.ordem_tem_cobranca_ativa(_ordem_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ordem_cobrancas
     WHERE ordem_id = _ordem_id AND situacao = 'ativa'
  )
$function$;

GRANT EXECUTE ON FUNCTION public.ordem_tem_cobranca_ativa(uuid) TO authenticated;

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
  v_faturavel boolean;
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

  -- Uma ordem cancelada com taxa/cobrança ativa continua sendo faturável
  v_faturavel := NEW.status = 'concluida'
                 OR (NEW.status = 'cancelada' AND public.ordem_tem_cobranca_ativa(NEW.id));

  IF (NEW.recebimento_pago AND NOT OLD.recebimento_pago AND NOT v_faturavel) THEN
    RAISE EXCEPTION 'Só é possível faturar uma ordem concluída ou uma ordem cancelada com cobrança em aberto';
  END IF;

  IF (NEW.pagamento_pago AND NOT OLD.pagamento_pago AND NEW.status <> 'concluida') THEN
    RAISE EXCEPTION 'Só é possível liquidar o pagamento de uma ordem concluída';
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
      IF public.ordem_tem_cobranca_ativa(NEW.id)
         AND EXISTS (SELECT 1 FROM public.ordem_cobrancas
                      WHERE ordem_id = NEW.id AND tipo = 'taxa_cancelamento' AND situacao = 'ativa') THEN
        RAISE EXCEPTION 'Estorne a taxa de cancelamento antes de reabrir esta ordem';
      END IF;
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

  IF NEW.chegada_em IS NOT NULL AND OLD.chegada_em IS NULL AND NEW.iniciada_em IS NULL THEN
    RAISE EXCEPTION 'Para anunciar a chegada é obrigatório iniciar o deslocamento';
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Exclusão nunca apaga dinheiro
CREATE OR REPLACE FUNCTION public.ordens_bloqueia_exclusao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.recebimento_pago OR OLD.pagamento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada ou paga não pode ser excluída';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_agente WHERE ordem_id = OLD.id) THEN
    RAISE EXCEPTION 'Ordem possui lançamentos financeiros e não pode ser excluída';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordem_cobrancas
              WHERE ordem_id = OLD.id AND tipo = 'taxa_cancelamento') THEN
    RAISE EXCEPTION 'Ordem com taxa de cancelamento não pode ser excluída: estorne a taxa para preservar o histórico';
  END IF;
  RETURN OLD;
END;
$function$;

-- 6. Cancelamento pela locadora: taxa idempotente e tipada
CREATE OR REPLACE FUNCTION public.cancelar_ordem_locadora(_ordem_id uuid, _motivo text DEFAULT ''::text, _aceite boolean DEFAULT false, _texto_aceite text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.ordens%ROWTYPE;
  v_loc uuid := public.locadora_do_usuario(auth.uid());
  v_iniciado boolean;
  v_valor numeric := 0;
  v_taxa numeric := 0;
  v_pct numeric := 0;
BEGIN
  SELECT * INTO o FROM public.ordens WHERE id = _ordem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  IF v_loc IS NULL OR o.locadora_id <> v_loc THEN
    RAISE EXCEPTION 'Esta solicitação não pertence à sua locadora';
  END IF;
  IF o.status = 'cancelada' THEN RAISE EXCEPTION 'Esta solicitação já está cancelada'; END IF;
  IF o.status = 'concluida' THEN RAISE EXCEPTION 'Recolhimento concluído não pode ser cancelado'; END IF;
  IF o.recebimento_pago OR o.pagamento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada: fale com a central';
  END IF;

  v_iniciado := o.iniciada_em IS NOT NULL;

  IF v_iniciado THEN
    IF NOT _aceite THEN
      RAISE EXCEPTION 'É obrigatório aceitar a cobrança de 50%% para cancelar após o início do deslocamento';
    END IF;
    v_valor := public.valor_servico_ordem(_ordem_id);
    v_pct := 50;
    v_taxa := round(v_valor * 0.5, 2);

    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
            'Taxa de cancelamento apresentada',
            'Valor do serviço ' || to_char(v_valor, 'FM999999990.00') ||
            ' • taxa 50% = ' || to_char(v_taxa, 'FM999999990.00'));

    IF v_taxa > 0 THEN
      INSERT INTO public.ordem_cobrancas (ordem_id, locadora_id, nome, valor, observacao, criado_por, tipo, situacao)
      VALUES (_ordem_id, o.locadora_id,
              'Taxa de cancelamento após início do deslocamento', v_taxa,
              'Cobrança de 50% aceita pela locadora no cancelamento.', auth.uid(),
              'taxa_cancelamento', 'ativa')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.cancelamentos_ordem (
    ordem_id, locadora_id, usuario_id, valor_original, percentual_cobranca,
    valor_cobranca, motivo, aceite_cobranca, texto_aceite, aceito_em
  ) VALUES (
    _ordem_id, o.locadora_id, auth.uid(), v_valor, v_pct, v_taxa,
    coalesce(_motivo, ''), v_iniciado AND _aceite, coalesce(_texto_aceite, ''),
    CASE WHEN v_iniciado AND _aceite THEN now() ELSE NULL END
  )
  ON CONFLICT (ordem_id) DO NOTHING;

  IF v_iniciado THEN
    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
            'Taxa de cancelamento aceita', coalesce(_texto_aceite, ''));
  END IF;

  UPDATE public.ordens
     SET status = 'cancelada', motivo_cancelamento = coalesce(_motivo, '')
   WHERE id = _ordem_id;

  INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
  VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
          'Cancelamento concluído', coalesce(nullif(_motivo, ''), 'sem motivo informado'));

  RETURN jsonb_build_object(
    'valor_original', v_valor, 'percentual', v_pct, 'valor_cobranca', v_taxa,
    'deslocamento_iniciado', v_iniciado
  );
END;
$function$;

-- 7. Cancelamento pela central também gera taxa rastreável
CREATE OR REPLACE FUNCTION public.registrar_taxa_cancelamento(_ordem_id uuid, _percentual numeric DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.ordens%ROWTYPE;
  v_valor numeric;
  v_taxa numeric;
  v_id uuid;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas a central pode lançar taxa de cancelamento manualmente';
  END IF;
  SELECT * INTO o FROM public.ordens WHERE id = _ordem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;

  SELECT id INTO v_id FROM public.ordem_cobrancas
   WHERE ordem_id = _ordem_id AND tipo = 'taxa_cancelamento';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_valor := public.valor_servico_ordem(_ordem_id);
  v_taxa := round(v_valor * (_percentual / 100.0), 2);
  IF v_taxa <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.ordem_cobrancas (ordem_id, locadora_id, nome, valor, observacao, criado_por, tipo, situacao)
  VALUES (_ordem_id, o.locadora_id,
          'Taxa de cancelamento após início do deslocamento', v_taxa,
          'Lançada pela central.', auth.uid(), 'taxa_cancelamento', 'ativa')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_taxa_cancelamento(uuid, numeric) TO authenticated;