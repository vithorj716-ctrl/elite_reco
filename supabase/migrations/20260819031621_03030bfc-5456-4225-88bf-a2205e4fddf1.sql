-- ============ Ações do agente ============
CREATE OR REPLACE FUNCTION public.aceitar_distribuicao(_dist uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE; v_agente uuid := public.agente_do_usuario(auth.uid());
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  IF v_agente IS NULL OR d.agente_id IS DISTINCT FROM v_agente THEN
    RAISE EXCEPTION 'Somente o agente principal desta operação pode aceitá-la';
  END IF;
  IF d.status = 'aceita' THEN RETURN; END IF;
  IF d.status NOT IN ('distribuida','notificada') THEN
    RAISE EXCEPTION 'Esta operação não está aguardando aceite';
  END IF;

  UPDATE public.distribuicoes SET status = 'aceita', aceita_em = now(), atualizado_em = now() WHERE id = _dist;
  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET aceita_em = now() WHERE id = d.ordem_id AND aceita_em IS NULL;
  ELSE
    UPDATE public.vistorias SET aceita_em = now() WHERE id = d.vistoria_id AND aceita_em IS NULL;
  END IF;
  PERFORM public.registrar_evento_distribuicao(_dist, 'Operação aceita pelo agente',
    coalesce((SELECT nome FROM public.agentes WHERE id = v_agente), ''), false,
    jsonb_build_object('status_anterior', d.status, 'status_novo', 'aceita'));
END; $$;

CREATE OR REPLACE FUNCTION public.recusar_distribuicao(_dist uuid, _motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE; v_agente uuid := public.agente_do_usuario(auth.uid());
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  IF v_agente IS NULL OR d.agente_id IS DISTINCT FROM v_agente THEN
    RAISE EXCEPTION 'Somente o agente principal desta operação pode recusá-la';
  END IF;
  IF d.status NOT IN ('distribuida','notificada','aceita') THEN
    RAISE EXCEPTION 'Esta operação não pode mais ser recusada';
  END IF;
  IF btrim(coalesce(_motivo,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;

  INSERT INTO public.distribuicao_recusas (distribuicao_id, agente_id, motivo)
  VALUES (_dist, v_agente, _motivo) ON CONFLICT DO NOTHING;

  UPDATE public.distribuicoes
     SET status = 'recusada', recusada_em = now(), aceita_em = NULL, atualizado_em = now()
   WHERE id = _dist;

  PERFORM public.registrar_evento_distribuicao(_dist, 'Operação recusada pelo agente', _motivo, false,
    jsonb_build_object('agente_id', v_agente));

  -- devolve a operação e sorteia outro agente elegível
  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET status = 'pendente' WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET status = 'pendente' WHERE id = d.vistoria_id;
  END IF;
  UPDATE public.distribuicoes SET agente_id = NULL WHERE id = _dist;
  PERFORM public.sortear_agente_distribuicao(_dist, 'automatica', NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.definir_auxiliar_distribuicao(_dist uuid, _auxiliar uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  d public.distribuicoes%ROWTYPE;
  v_agente uuid := public.agente_do_usuario(auth.uid());
  v_equipe boolean := public.equipe(auth.uid());
  v_ok boolean;
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  IF NOT v_equipe AND (v_agente IS NULL OR d.agente_id IS DISTINCT FROM v_agente) THEN
    RAISE EXCEPTION 'Somente o agente principal ou a central podem definir o auxiliar';
  END IF;
  IF NOT v_equipe AND d.status <> 'aceita' THEN
    RAISE EXCEPTION 'Aceite a operação antes de escolher um auxiliar';
  END IF;

  IF _auxiliar IS NULL THEN
    IF NOT v_equipe THEN RAISE EXCEPTION 'Somente a central pode remover o auxiliar'; END IF;
    UPDATE public.distribuicoes SET agente_auxiliar_id = NULL, atualizado_em = now() WHERE id = _dist;
    IF d.tipo = 'recolhimento' THEN
      UPDATE public.ordens SET agente_auxiliar_id = NULL, valor_pagamento_auxiliar = NULL,
             valor_pagamento = d.valor_pagamento WHERE id = d.ordem_id;
    ELSE
      UPDATE public.vistorias SET agente_auxiliar_id = NULL, valor_pagamento_auxiliar = NULL,
             valor_pagamento = d.valor_pagamento WHERE id = d.vistoria_id;
    END IF;
    PERFORM public.registrar_evento_distribuicao(_dist, 'Auxiliar removido', '', false, '{}'::jsonb);
    RETURN;
  END IF;

  IF _auxiliar = d.agente_id THEN
    RAISE EXCEPTION 'O auxiliar precisa ser diferente do agente principal';
  END IF;
  SELECT ativo AND situacao = 'ativo' INTO v_ok FROM public.agentes WHERE id = _auxiliar;
  IF NOT coalesce(v_ok, false) THEN RAISE EXCEPTION 'Este agente não está elegível'; END IF;

  UPDATE public.distribuicoes SET agente_auxiliar_id = _auxiliar, atualizado_em = now() WHERE id = _dist;
  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens
       SET agente_auxiliar_id = _auxiliar,
           valor_pagamento_principal = d.valor_pagamento,
           valor_pagamento_auxiliar = d.valor_pagamento,
           valor_pagamento = d.valor_pagamento * 2
     WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias
       SET agente_auxiliar_id = _auxiliar,
           valor_pagamento_principal = d.valor_pagamento,
           valor_pagamento_auxiliar = d.valor_pagamento,
           valor_pagamento = d.valor_pagamento * 2
     WHERE id = d.vistoria_id;
  END IF;

  PERFORM public.registrar_evento_distribuicao(_dist, 'Auxiliar definido',
    coalesce((SELECT nome FROM public.agentes WHERE id = _auxiliar), '') ||
    ' — repasse igual ao principal (R$ ' || to_char(d.valor_pagamento, 'FM999999990.00') || ')',
    false, jsonb_build_object('auxiliar_id', _auxiliar, 'valor', d.valor_pagamento));

  PERFORM public.notificar_agente(_auxiliar, 'nova_ordem', 'Você entrou como apoio em uma operação',
    d.servico_nome, d.ordem_id);
END; $$;

-- ============ Ações do administrador ============
CREATE OR REPLACE FUNCTION public.admin_redistribuir(_dist uuid, _agente uuid DEFAULT NULL, _motivo text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE; v_novo uuid;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode redistribuir'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  IF d.status IN ('concluida','cancelada') THEN RAISE EXCEPTION 'Operação encerrada não pode ser redistribuída'; END IF;

  PERFORM public.registrar_evento_distribuicao(_dist,
    CASE WHEN _agente IS NULL THEN 'Redistribuição solicitada' ELSE 'Troca de agente solicitada' END,
    coalesce(nullif(_motivo,''), 'sem motivo informado') || ' • agente anterior: ' ||
    coalesce((SELECT nome FROM public.agentes WHERE id = d.agente_id), 'nenhum'),
    false, jsonb_build_object('agente_anterior', d.agente_id, 'motivo', _motivo));

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET status = 'pendente' WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET status = 'pendente' WHERE id = d.vistoria_id;
  END IF;
  UPDATE public.distribuicoes
     SET agente_id = NULL, motivo = coalesce(_motivo,''), atualizado_em = now()
   WHERE id = _dist;

  v_novo := public.sortear_agente_distribuicao(_dist, 'redistribuida', _agente);
  UPDATE public.distribuicoes SET origem = 'redistribuida' WHERE id = _dist;
  RETURN v_novo;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_alterar_servico(_dist uuid, _servico uuid, _motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE; v_nome text; v_cob numeric; v_pag numeric;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode alterar o serviço'; END IF;
  IF btrim(coalesce(_motivo,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo da alteração'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  SELECT nome INTO v_nome FROM public.servicos WHERE id = _servico AND ativo;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Escolha um serviço ativo do catálogo'; END IF;

  v_cob := public.valor_tabela_servico(d.locadora_id, _servico, 'cobranca');
  v_pag := public.valor_tabela_servico(d.locadora_id, _servico, 'pagamento');

  UPDATE public.distribuicoes
     SET servico_id = _servico, servico_nome = v_nome, valor_cobranca = v_cob,
         valor_pagamento = v_pag, origem = 'manual', motivo = _motivo, atualizado_em = now()
   WHERE id = _dist;

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET servico_id = _servico, valor_cobranca = v_cob,
           valor_pagamento_principal = v_pag,
           valor_pagamento_auxiliar = CASE WHEN agente_auxiliar_id IS NULL THEN NULL ELSE v_pag END,
           valor_pagamento = CASE WHEN agente_auxiliar_id IS NULL THEN v_pag ELSE v_pag * 2 END
     WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET servico_id = _servico, valor_cobranca = v_cob,
           valor_pagamento_principal = v_pag,
           valor_pagamento_auxiliar = CASE WHEN agente_auxiliar_id IS NULL THEN NULL ELSE v_pag END,
           valor_pagamento = CASE WHEN agente_auxiliar_id IS NULL THEN v_pag ELSE v_pag * 2 END
     WHERE id = d.vistoria_id;
  END IF;

  PERFORM public.registrar_evento_distribuicao(_dist, 'Serviço alterado pelo administrador',
    d.servico_nome || ' → ' || v_nome || ' • ' || _motivo, false,
    jsonb_build_object('servico_anterior', d.servico_id, 'servico_novo', _servico,
                       'valor_anterior', d.valor_cobranca, 'valor_novo', v_cob));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_alterar_valor(
  _dist uuid, _cobranca numeric, _pagamento numeric, _motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode alterar valores'; END IF;
  IF btrim(coalesce(_motivo,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo da alteração'; END IF;
  IF _cobranca < 0 OR _pagamento < 0 THEN RAISE EXCEPTION 'Os valores não podem ser negativos'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;

  UPDATE public.distribuicoes
     SET valor_cobranca = _cobranca, valor_pagamento = _pagamento, origem = 'manual',
         motivo = _motivo, atualizado_em = now()
   WHERE id = _dist;

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET valor_cobranca = _cobranca,
           valor_pagamento_principal = _pagamento,
           valor_pagamento_auxiliar = CASE WHEN agente_auxiliar_id IS NULL THEN NULL ELSE _pagamento END,
           valor_pagamento = CASE WHEN agente_auxiliar_id IS NULL THEN _pagamento ELSE _pagamento * 2 END
     WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET valor_cobranca = _cobranca,
           valor_pagamento_principal = _pagamento,
           valor_pagamento_auxiliar = CASE WHEN agente_auxiliar_id IS NULL THEN NULL ELSE _pagamento END,
           valor_pagamento = CASE WHEN agente_auxiliar_id IS NULL THEN _pagamento ELSE _pagamento * 2 END
     WHERE id = d.vistoria_id;
  END IF;

  PERFORM public.registrar_evento_distribuicao(_dist, 'Valor alterado pelo administrador',
    'Cobrança R$ ' || to_char(d.valor_cobranca,'FM999999990.00') || ' → R$ ' || to_char(_cobranca,'FM999999990.00') ||
    ' • Pagamento R$ ' || to_char(d.valor_pagamento,'FM999999990.00') || ' → R$ ' || to_char(_pagamento,'FM999999990.00') ||
    ' • ' || _motivo, false,
    jsonb_build_object('cobranca_anterior', d.valor_cobranca, 'cobranca_nova', _cobranca,
                       'pagamento_anterior', d.valor_pagamento, 'pagamento_novo', _pagamento));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_distribuicao(_dist uuid, _motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode cancelar a distribuição'; END IF;
  IF btrim(coalesce(_motivo,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;

  UPDATE public.distribuicoes SET status = 'cancelada', cancelada_em = now(),
         motivo = _motivo, atualizado_em = now() WHERE id = _dist;
  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET status = 'cancelada', motivo_cancelamento = _motivo WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET status = 'cancelada', motivo_cancelamento = _motivo WHERE id = d.vistoria_id;
  END IF;
  PERFORM public.registrar_evento_distribuicao(_dist, 'Distribuição cancelada', _motivo, false, '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.reenviar_notificacao_distribuicao(_dist uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.distribuicoes%ROWTYPE; v_resumo text;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode reenviar a notificação'; END IF;
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist;
  IF d.agente_id IS NULL THEN RAISE EXCEPTION 'Esta operação ainda não tem agente'; END IF;
  v_resumo := d.servico_nome || ' • ' || coalesce((SELECT placa FROM public.motos WHERE id = d.moto_id), '');
  IF d.tipo = 'recolhimento' THEN
    PERFORM public.notificar_agente(d.agente_id, 'nova_ordem', 'Nova operação disponível', v_resumo, d.ordem_id);
  ELSE
    PERFORM public.notificar_agente_vistoria(d.agente_id, 'nova_ordem', 'Nova operação disponível', v_resumo, d.vistoria_id);
  END IF;
  UPDATE public.distribuicoes SET notificada_em = now() WHERE id = _dist;
  PERFORM public.registrar_evento_distribuicao(_dist, 'Notificação reenviada', v_resumo, false, '{}'::jsonb);
END; $$;

-- ============ Espelho do andamento da operação ============
CREATE OR REPLACE FUNCTION public.sincronizar_distribuicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dist uuid; v_novo public.distribuicao_status;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'ordens' THEN
    SELECT id INTO v_dist FROM public.distribuicoes WHERE ordem_id = NEW.id;
  ELSE
    SELECT id INTO v_dist FROM public.distribuicoes WHERE vistoria_id = NEW.id;
  END IF;
  IF v_dist IS NULL THEN RETURN NEW; END IF;

  v_novo := CASE NEW.status::text
    WHEN 'em_andamento' THEN 'em_execucao'::public.distribuicao_status
    WHEN 'concluida'    THEN 'concluida'::public.distribuicao_status
    WHEN 'cancelada'    THEN 'cancelada'::public.distribuicao_status
    ELSE NULL END;
  IF v_novo IS NULL THEN RETURN NEW; END IF;

  UPDATE public.distribuicoes
     SET status = v_novo, atualizado_em = now(),
         concluida_em = CASE WHEN v_novo = 'concluida' THEN now() ELSE concluida_em END,
         cancelada_em = CASE WHEN v_novo = 'cancelada' THEN now() ELSE cancelada_em END
   WHERE id = v_dist AND status <> v_novo;

  PERFORM public.registrar_evento_distribuicao(v_dist, 'Situação da operação: ' || NEW.status::text, '', true, '{}'::jsonb);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sincronizar_distribuicao_ordens ON public.ordens;
CREATE TRIGGER sincronizar_distribuicao_ordens AFTER UPDATE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_distribuicao();

DROP TRIGGER IF EXISTS sincronizar_distribuicao_vistorias ON public.vistorias;
CREATE TRIGGER sincronizar_distribuicao_vistorias AFTER UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_distribuicao();

REVOKE ALL ON FUNCTION public.sincronizar_distribuicao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_distribuicao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recusar_distribuicao(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.definir_auxiliar_distribuicao(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_redistribuir(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_alterar_servico(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_alterar_valor(uuid, numeric, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_cancelar_distribuicao(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.reenviar_notificacao_distribuicao(uuid) FROM anon;