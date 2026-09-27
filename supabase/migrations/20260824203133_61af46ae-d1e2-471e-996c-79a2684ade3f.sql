-- Disponibilidade = decisão explícita do agente. Comunicação recente do aparelho
-- passa a ser apenas informativa e nunca remove a elegibilidade.

CREATE OR REPLACE FUNCTION public.agente_disponivel(_agente uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agentes a
     WHERE a.id = _agente AND a.ativo AND a.situacao = 'ativo' AND a.online
  ) AND NOT public.agente_ocupado(_agente)
$function$;

CREATE OR REPLACE FUNCTION public.sortear_agente_distribuicao(_dist uuid, _origem distribuicao_origem DEFAULT 'automatica'::distribuicao_origem, _forcado uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d public.distribuicoes%ROWTYPE;
  v_cidade text;
  v_escolhido uuid;
  v_elegiveis jsonb := '[]'::jsonb;
  v_descartados jsonb := '[]'::jsonb;
  v_resumo text;
  v_regra text;
  v_valor numeric;
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  PERFORM pg_advisory_xact_lock(hashtext('distribuicao_sorteio'));

  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;

  SELECT cidade INTO v_cidade FROM public.locadoras WHERE id = d.locadora_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'cidade', a.cidade)), '[]'::jsonb)
    INTO v_elegiveis
    FROM public.agentes a
   WHERE a.ativo AND a.situacao = 'ativo' AND a.online
     AND NOT public.agente_ocupado(a.id)
     AND public.agente_aceita_servico(a.id, d.servico_id)
     AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
     AND a.id IS DISTINCT FROM d.agente_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'motivo',
           CASE WHEN NOT a.ativo THEN 'inativo'
                WHEN a.situacao <> 'ativo' THEN 'situação ' || a.situacao
                WHEN EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id) THEN 'recusou esta operação'
                WHEN NOT a.online THEN 'offline'
                WHEN public.agente_ocupado(a.id) THEN 'ocupado com outra operação'
                WHEN NOT public.agente_aceita_servico(a.id, d.servico_id) THEN 'não aceita este tipo de serviço'
                ELSE 'agente atual' END)), '[]'::jsonb)
    INTO v_descartados
    FROM public.agentes a
   WHERE NOT (a.ativo AND a.situacao = 'ativo' AND a.online
              AND NOT public.agente_ocupado(a.id)
              AND public.agente_aceita_servico(a.id, d.servico_id)
              AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
              AND a.id IS DISTINCT FROM d.agente_id);

  IF _forcado IS NOT NULL THEN
    v_escolhido := _forcado;
    v_regra := 'Agente definido manualmente pelo administrador';
  ELSE
    SELECT a.id INTO v_escolhido
      FROM public.agentes a
     WHERE a.ativo AND a.situacao = 'ativo' AND a.online
       AND NOT public.agente_ocupado(a.id)
       AND public.agente_aceita_servico(a.id, d.servico_id)
       AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
       AND a.id IS DISTINCT FROM d.agente_id
       AND v_cidade <> '' AND (lower(a.cidade) = lower(v_cidade) OR v_cidade = ANY (a.cidades_atendidas))
     ORDER BY random() LIMIT 1;
    v_regra := 'Sorteio entre agentes online e disponíveis que atendem ' || coalesce(nullif(v_cidade,''), 'a região');

    IF v_escolhido IS NULL THEN
      SELECT a.id INTO v_escolhido
        FROM public.agentes a
       WHERE a.ativo AND a.situacao = 'ativo' AND a.online
         AND NOT public.agente_ocupado(a.id)
         AND public.agente_aceita_servico(a.id, d.servico_id)
         AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
         AND a.id IS DISTINCT FROM d.agente_id
       ORDER BY random() LIMIT 1;
      v_regra := 'Sorteio entre todos os agentes online e disponíveis';
    END IF;
  END IF;

  UPDATE public.distribuicoes
     SET elegiveis = v_elegiveis, descartados = v_descartados, regra = v_regra,
         origem = _origem, atualizado_em = now()
   WHERE id = _dist;

  IF v_escolhido IS NULL THEN
    UPDATE public.distribuicoes SET status = 'aguardando_distribuicao', agente_id = NULL WHERE id = _dist;
    IF d.status <> 'aguardando_distribuicao' THEN
      PERFORM public.registrar_evento_distribuicao(_dist, 'Aguardando agente',
        'Nenhum agente online, disponível e habilitado para este serviço — a operação segue na fila', true,
        jsonb_build_object('descartados', v_descartados));
      PERFORM public.notificar_equipe('operacional', 'Operação aguardando agente',
        'A operação entrou na fila e será distribuída assim que um agente elegível ficar online.', NULL);
    END IF;
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

  v_valor := coalesce(d.valor_pagamento, 0);
  v_resumo := d.servico_nome
    || coalesce(' • ' || nullif((SELECT placa FROM public.motos WHERE id = d.moto_id), ''), '')
    || coalesce(' • ' || nullif((SELECT cidade FROM public.locadoras WHERE id = d.locadora_id), ''), '')
    || CASE WHEN v_valor > 0 THEN ' • você recebe R$ ' || to_char(v_valor, 'FM999G999D00') ELSE '' END;

  PERFORM public.registrar_evento_distribuicao(_dist,
    CASE WHEN _forcado IS NULL THEN 'Agente sorteado automaticamente' ELSE 'Agente definido pelo administrador' END,
    coalesce((SELECT nome FROM public.agentes WHERE id = v_escolhido), '') || ' — ' || v_regra,
    _forcado IS NULL,
    jsonb_build_object('agente_id', v_escolhido, 'elegiveis', v_elegiveis, 'descartados', v_descartados));

  PERFORM public.registrar_evento_distribuicao(_dist, 'Notificação enviada', v_resumo, true,
    jsonb_build_object('agente_id', v_escolhido));

  IF d.tipo = 'recolhimento' THEN
    PERFORM public.notificar_agente(v_escolhido, 'nova_ordem', 'Nova solicitação de recolhimento', v_resumo, d.ordem_id);
  ELSE
    PERFORM public.notificar_agente_vistoria(v_escolhido, 'nova_ordem', 'Nova solicitação de vistoria', v_resumo, d.vistoria_id);
  END IF;

  RETURN v_escolhido;
END; $function$;