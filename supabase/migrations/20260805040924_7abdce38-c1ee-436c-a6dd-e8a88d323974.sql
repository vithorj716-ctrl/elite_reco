CREATE OR REPLACE FUNCTION public.ordens_regras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipe boolean := public.equipe(auth.uid());
  v_liquidada boolean;
  v_conclusao boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_equipe THEN
      NEW.status := 'pendente';
      NEW.agente_id := NULL;
      NEW.recebimento_pago := false;
      NEW.pagamento_pago := false;
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
      NEW.distribuida_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
    END IF;
    IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
      NEW.codigo := 'OS-' || lpad(nextval('public.ordens_codigo_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
  END IF;

  v_liquidada := OLD.recebimento_pago OR OLD.pagamento_pago;
  -- Agente concluindo a própria ordem em campo: congelar valores é permitido
  v_conclusao := OLD.status = 'em_andamento' AND NEW.status = 'concluida';

  IF NOT v_equipe THEN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
       OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'Agente não pode alterar dados cadastrais ou financeiros da ordem';
    END IF;

    IF NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento THEN
      IF v_conclusao AND OLD.valor_cobranca IS NULL AND OLD.valor_pagamento IS NULL THEN
        NULL; -- congelamento único no fechamento em campo
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
            OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
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
        RAISE EXCEPTION 'Ordem distribuída precisa de um agente';
      END IF;
      NEW.distribuida_em := COALESCE(NEW.distribuida_em, now());
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
    ELSIF NEW.status = 'em_andamento' THEN
      NEW.iniciada_em := COALESCE(NEW.iniciada_em, now());
    ELSIF NEW.status = 'concluida' THEN
      IF NEW.iniciada_em IS NULL THEN
        RAISE EXCEPTION 'Não é possível concluir uma ordem que não foi iniciada em campo';
      END IF;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSIF NEW.status = 'cancelada' THEN
      NEW.cancelada_em := now();
    ELSIF NEW.status = 'pendente' THEN
      NEW.agente_id := NULL;
      NEW.distribuida_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;