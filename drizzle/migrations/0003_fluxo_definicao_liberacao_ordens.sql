CREATE OR REPLACE FUNCTION public.ordens_regras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipe boolean := public.equipe(auth.uid()) OR public.modo_distribuicao();
  v_cliente boolean;
  v_liquidada boolean;
  v_conclusao boolean;
  v_faturavel boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_equipe THEN
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
    IF NEW.agente_id IS NULL AND NEW.status::text IN ('pendente','pendente_definicao','liberada') THEN
      NEW.status := 'pendente_definicao';
    END IF;
    NEW.valor_cobranca_base := NULL;
    NEW.valor_cobranca_adicional := 0;
    NEW.valor_cobranca_final := NULL;
    NEW.valor_pagamento_base := NULL;
    NEW.valor_pagamento_adicional := 0;
    NEW.valor_pagamento_final := NULL;
    NEW.definido_por := NULL; NEW.definido_em := NULL;
    NEW.liberado_por := NULL; NEW.liberado_em := NULL;
    NEW.legado := false;
    NEW.horario_especial := public.em_horario_especial(coalesce(NEW.criada_em, now()));

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
       OR NEW.valor_cobranca_final IS DISTINCT FROM OLD.valor_cobranca_final
       OR NEW.valor_pagamento_final IS DISTINCT FROM OLD.valor_pagamento_final
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
       OR NEW.servico_id IS DISTINCT FROM OLD.servico_id
       OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
       OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'Agente não pode alterar dados cadastrais, o serviço ou dados financeiros da ordem';
    END IF;

    IF NEW.valor_cobranca_base IS DISTINCT FROM OLD.valor_cobranca_base
       OR NEW.valor_cobranca_adicional IS DISTINCT FROM OLD.valor_cobranca_adicional
       OR NEW.valor_cobranca_final IS DISTINCT FROM OLD.valor_cobranca_final
       OR NEW.valor_pagamento_base IS DISTINCT FROM OLD.valor_pagamento_base
       OR NEW.valor_pagamento_adicional IS DISTINCT FROM OLD.valor_pagamento_adicional
       OR NEW.valor_pagamento_final IS DISTINCT FROM OLD.valor_pagamento_final
       OR NEW.liberado_em IS DISTINCT FROM OLD.liberado_em
       OR NEW.definido_em IS DISTINCT FROM OLD.definido_em THEN
      RAISE EXCEPTION 'Agente não pode alterar os valores definidos pelo administrador';
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
            OR NEW.valor_cobranca_final IS DISTINCT FROM OLD.valor_cobranca_final
            OR NEW.valor_pagamento_final IS DISTINCT FROM OLD.valor_pagamento_final
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
      (OLD.status::text = 'pendente_definicao' AND NEW.status::text IN ('liberada','cancelada'))
      OR (OLD.status::text IN ('liberada','pendente') AND NEW.status::text IN ('distribuida','pendente_definicao','liberada','cancelada'))
      OR (OLD.status::text = 'distribuida'  AND NEW.status::text IN ('em_andamento','liberada','pendente_definicao','distribuida','cancelada'))
      OR (OLD.status::text = 'em_andamento' AND NEW.status::text IN ('concluida','liberada','pendente_definicao','cancelada'))
      OR (OLD.status::text = 'concluida'    AND NEW.status::text = 'pendente_definicao')
      OR (OLD.status::text = 'cancelada'    AND NEW.status::text IN ('pendente_definicao','liberada'))
    ) THEN
      RAISE EXCEPTION 'Transição de situação inválida: % para %', OLD.status, NEW.status;
    END IF;

    IF NEW.status::text = 'liberada' THEN
      IF NOT NEW.legado AND (coalesce(NEW.valor_cobranca_final, 0) <= 0 OR coalesce(NEW.valor_pagamento_final, 0) <= 0) THEN
        RAISE EXCEPTION 'Defina o valor da cobrança da locadora e o repasse do agente antes de liberar a operação';
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
    ELSIF NEW.status = 'distribuida' THEN
      IF NEW.agente_id IS NULL THEN
        RAISE EXCEPTION 'Ordem distribuída precisa de um agente principal';
      END IF;
      IF NEW.liberado_em IS NULL THEN
        RAISE EXCEPTION 'Defina e libere os valores da operação antes de distribuí-la';
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
    ELSIF NEW.status::text = 'pendente_definicao' THEN
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
    END IF;
  END IF;

  IF NEW.chegada_em IS NOT NULL AND OLD.chegada_em IS NULL AND NEW.iniciada_em IS NULL THEN
    RAISE EXCEPTION 'Para anunciar a chegada é obrigatório iniciar o deslocamento';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ordem_exige_liberacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text IN ('distribuida','em_andamento') AND NEW.liberado_em IS NULL THEN
    RAISE EXCEPTION 'Esta operação ainda aguarda a definição de valores pelo administrador';
  END IF;
  IF NEW.agente_id IS NOT NULL AND OLD.agente_id IS NULL AND NEW.liberado_em IS NULL THEN
    RAISE EXCEPTION 'Defina e libere os valores da operação antes de designar um agente';
  END IF;
  RETURN NEW;
END $function$;