CREATE OR REPLACE FUNCTION public.aprovar_distribuicao(_dist uuid, _cobranca_base numeric, _cobranca_adicional numeric, _pagamento_base numeric, _pagamento_adicional numeric, _motivo text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.distribuicoes%ROWTYPE; v_quem text; v_cob numeric; v_pag numeric; v_agente uuid;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode liberar operações'; END IF;
  IF coalesce(_cobranca_base, 0) < 0 OR coalesce(_cobranca_adicional, 0) < 0
     OR coalesce(_pagamento_base, 0) < 0 OR coalesce(_pagamento_adicional, 0) < 0 THEN
    RAISE EXCEPTION 'Os valores não podem ser negativos';
  END IF;

  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF d.aprovada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta operação já foi liberada'; END IF;
  IF d.status <> 'aguardando_definicao' THEN RAISE EXCEPTION 'Esta operação não está aguardando definição'; END IF;

  v_cob := coalesce(_cobranca_base, 0) + coalesce(_cobranca_adicional, 0);
  v_pag := coalesce(_pagamento_base, 0) + coalesce(_pagamento_adicional, 0);
  IF v_cob <= 0 THEN RAISE EXCEPTION 'Defina o valor da cobrança da locadora antes de liberar'; END IF;
  IF v_pag <= 0 THEN RAISE EXCEPTION 'Defina o valor do repasse do agente antes de liberar'; END IF;

  SELECT coalesce(nullif(btrim(nome), ''), email) INTO v_quem FROM public.profiles WHERE id = auth.uid();

  UPDATE public.distribuicoes
     SET valor_cobranca_base = coalesce(_cobranca_base, 0),
         valor_cobranca_adicional = coalesce(_cobranca_adicional, 0),
         valor_pagamento_base = coalesce(_pagamento_base, 0),
         valor_pagamento_adicional = coalesce(_pagamento_adicional, 0),
         valor_cobranca = v_cob, valor_pagamento = v_pag,
         aprovada_em = now(), aprovada_por = auth.uid(),
         aprovada_por_nome = coalesce(v_quem, 'Central'),
         motivo = coalesce(nullif(btrim(_motivo), ''), d.motivo),
         status = 'aguardando_distribuicao', atualizado_em = now()
   WHERE id = _dist;

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens
       SET valor_cobranca_base = coalesce(_cobranca_base, 0),
           valor_cobranca_adicional = coalesce(_cobranca_adicional, 0),
           valor_cobranca_final = v_cob,
           valor_pagamento_base = coalesce(_pagamento_base, 0),
           valor_pagamento_adicional = coalesce(_pagamento_adicional, 0),
           valor_pagamento_final = v_pag,
           valor_cobranca = v_cob, valor_pagamento = v_pag, valor_pagamento_principal = v_pag,
           definido_por = auth.uid(), definido_em = now(),
           liberado_por = auth.uid(), liberado_em = now(),
           status = 'liberada'
     WHERE id = d.ordem_id;

    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (d.ordem_id, coalesce(v_quem, 'Central'), 'Valores definidos e operação liberada',
      'Cobrança da locadora R$ ' || to_char(v_cob, 'FM999999990.00') ||
      ' (base R$ ' || to_char(coalesce(_cobranca_base,0), 'FM999999990.00') ||
      ' + adicional R$ ' || to_char(coalesce(_cobranca_adicional,0), 'FM999999990.00') ||
      ') • Repasse do agente R$ ' || to_char(v_pag, 'FM999999990.00') ||
      ' (base R$ ' || to_char(coalesce(_pagamento_base,0), 'FM999999990.00') ||
      ' + adicional R$ ' || to_char(coalesce(_pagamento_adicional,0), 'FM999999990.00') || ')' ||
      CASE WHEN d.horario_especial THEN ' • lançamento após horário especial' ELSE '' END);
  ELSE
    UPDATE public.vistorias
       SET valor_cobranca = v_cob, valor_pagamento = v_pag, valor_pagamento_principal = v_pag
     WHERE id = d.vistoria_id;
  END IF;

  PERFORM public.registrar_evento_distribuicao(_dist, 'Valores definidos e operação liberada',
    'Cobrança R$ ' || to_char(v_cob, 'FM999999990.00') || ' (base R$ ' || to_char(coalesce(_cobranca_base,0), 'FM999999990.00') ||
    ' + adicional R$ ' || to_char(coalesce(_cobranca_adicional,0), 'FM999999990.00') || ') • Repasse R$ ' ||
    to_char(v_pag, 'FM999999990.00') || ' (base R$ ' || to_char(coalesce(_pagamento_base,0), 'FM999999990.00') ||
    ' + adicional R$ ' || to_char(coalesce(_pagamento_adicional,0), 'FM999999990.00') || ')' ||
    coalesce(' • ' || nullif(btrim(_motivo), ''), ''), false,
    jsonb_build_object('cobranca', v_cob, 'pagamento', v_pag, 'horario_especial', d.horario_especial,
      'referencia_cobranca', d.referencia_cobranca, 'referencia_pagamento', d.referencia_pagamento,
      'aprovada_por', auth.uid(), 'aprovada_em', now()));

  INSERT INTO public.auditoria (entidade, registro_id, acao, quem, quem_nome, dados)
  VALUES ('distribuicoes', _dist, 'liberou', auth.uid(), coalesce(v_quem, 'Central'),
    jsonb_build_object('cobranca', v_cob, 'pagamento', v_pag, 'horario_especial', d.horario_especial,
      'cobranca_base', coalesce(_cobranca_base,0), 'cobranca_adicional', coalesce(_cobranca_adicional,0),
      'pagamento_base', coalesce(_pagamento_base,0), 'pagamento_adicional', coalesce(_pagamento_adicional,0)));

  v_agente := public.sortear_agente_distribuicao(_dist, 'automatica', NULL);
  RETURN v_agente;
END $function$;

CREATE OR REPLACE FUNCTION public.recusar_distribuicao(_dist uuid, _motivo text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET status = 'liberada' WHERE id = d.ordem_id;
    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (d.ordem_id, coalesce((SELECT nome FROM public.agentes WHERE id = v_agente), 'Agente'),
            'Operação recusada pelo agente', _motivo);
  ELSE
    UPDATE public.vistorias SET status = 'pendente' WHERE id = d.vistoria_id;
  END IF;
  UPDATE public.distribuicoes SET agente_id = NULL WHERE id = _dist;
  PERFORM public.sortear_agente_distribuicao(_dist, 'automatica', NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_redistribuir(_dist uuid, _agente uuid DEFAULT NULL::uuid, _motivo text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.distribuicoes%ROWTYPE; v_novo uuid;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN RAISE EXCEPTION 'Apenas a central pode redistribuir'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);
  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;
  IF d.status IN ('concluida','cancelada') THEN RAISE EXCEPTION 'Operação encerrada não pode ser redistribuída'; END IF;
  IF d.aprovada_em IS NULL THEN RAISE EXCEPTION 'Defina e libere os valores da operação antes de distribuí-la'; END IF;

  PERFORM public.registrar_evento_distribuicao(_dist,
    CASE WHEN _agente IS NULL THEN 'Redistribuição solicitada' ELSE 'Troca de agente solicitada' END,
    coalesce(nullif(_motivo,''), 'sem motivo informado') || ' • agente anterior: ' ||
    coalesce((SELECT nome FROM public.agentes WHERE id = d.agente_id), 'nenhum'),
    false, jsonb_build_object('agente_anterior', d.agente_id, 'motivo', _motivo));

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET status = 'liberada' WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET status = 'pendente' WHERE id = d.vistoria_id;
  END IF;
  UPDATE public.distribuicoes
     SET agente_id = NULL, motivo = coalesce(_motivo,''), atualizado_em = now()
   WHERE id = _dist;

  v_novo := public.sortear_agente_distribuicao(_dist, 'redistribuida', _agente);
  UPDATE public.distribuicoes SET origem = 'redistribuida' WHERE id = _dist;
  RETURN v_novo;
END $function$;

CREATE OR REPLACE FUNCTION public.transferir_ordem_agente(_ordem uuid, _agente uuid, _motivo text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.ordens%rowtype;
  v_anterior text;
  v_novo text;
  v_quem text;
  v_uid uuid := auth.uid();
begin
  if not public.equipe(v_uid) then
    raise exception 'Somente a equipe operacional pode transferir uma ordem entre agentes';
  end if;

  select * into o from public.ordens where id = _ordem for update;
  if not found then raise exception 'Ordem não encontrada'; end if;

  if o.status::text in ('concluida','cancelada') then
    raise exception 'Ordem % está % e não pode ser transferida pelo fluxo operacional', o.codigo, o.status;
  end if;
  if o.status::text = 'pendente_definicao' or o.liberado_em is null then
    raise exception 'Defina e libere os valores da operação % antes de designar um agente', o.codigo;
  end if;
  if o.recebimento_pago or o.pagamento_pago then
    raise exception 'Ordem % já está faturada ou paga. Estorne a liquidação antes de transferir.', o.codigo;
  end if;
  if _agente is null then raise exception 'Escolha o novo agente responsável'; end if;
  if o.agente_id is not null and o.agente_id = _agente then
    raise exception 'Este agente já é o responsável pela ordem %', o.codigo;
  end if;

  select nome into v_novo from public.agentes where id = _agente and ativo;
  if v_novo is null then raise exception 'O novo agente precisa estar cadastrado e ativo'; end if;
  select nome into v_anterior from public.agentes where id = o.agente_id;

  select coalesce(nullif(p.nome,''), nullif(p.email,''), 'operador')
    into v_quem from public.profiles p where p.id = v_uid;
  v_quem := coalesce(v_quem, 'operador');

  update public.ordens set
    agente_id = _agente,
    agente_auxiliar_id = case when agente_auxiliar_id = _agente then null else agente_auxiliar_id end,
    status = case when status::text in ('liberada','pendente') then 'distribuida'::status_ordem else status end,
    distribuida_em = now(),
    aceita_em = case when status::text = 'distribuida' then null else aceita_em end
  where id = _ordem;

  insert into public.ordem_historico (ordem_id, quem, acao, detalhe)
  values (
    _ordem, v_quem, 'Ordem transferida',
    'Agente anterior: ' || coalesce(v_anterior, 'sem agente') ||
    ' · Novo agente: ' || v_novo ||
    ' · Situação na transferência: ' || o.status::text ||
    case when o.status::text = 'em_andamento' then ' (rota já iniciada — marcos de campo preservados)' else '' end ||
    coalesce(' · Motivo: ' || nullif(btrim(_motivo), ''), '')
  );

  insert into public.auditoria (entidade, registro_id, acao, quem, quem_nome, dados)
  values ('ordens', _ordem, 'alterou', v_uid, v_quem,
    jsonb_build_object('acao', 'transferencia_de_agente', 'codigo', o.codigo, 'placa', o.placa,
      'status', o.status, 'agente_anterior', o.agente_id, 'agente_anterior_nome', v_anterior,
      'agente_novo', _agente, 'agente_novo_nome', v_novo, 'motivo', btrim(coalesce(_motivo,''))));

  return _ordem;
end $function$;

CREATE OR REPLACE FUNCTION public.aceitar_ordem(_ordem uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.ordens%ROWTYPE; v_agente uuid := public.agente_do_usuario(auth.uid()); v_dist uuid; v_linhas integer;
BEGIN
  IF v_agente IS NULL THEN RAISE EXCEPTION 'Somente um agente de campo pode aceitar uma operação'; END IF;
  PERFORM set_config('app.distribuicao', '1', true);

  SELECT * INTO o FROM public.ordens WHERE id = _ordem FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  IF o.liberado_em IS NULL OR o.status::text = 'pendente_definicao' THEN
    RAISE EXCEPTION 'Esta operação ainda aguarda a definição de valores pelo administrador';
  END IF;
  IF o.status::text IN ('concluida','cancelada') THEN
    RAISE EXCEPTION 'Esta operação já foi encerrada';
  END IF;
  IF o.agente_id IS NOT NULL AND o.agente_id IS DISTINCT FROM v_agente THEN
    RAISE EXCEPTION 'Esta operação já foi assumida por outro agente';
  END IF;
  IF o.agente_id IS NULL AND NOT public.agente_aceita_servico(v_agente, o.servico_id) THEN
    RAISE EXCEPTION 'Você não aceita este tipo de serviço';
  END IF;

  UPDATE public.ordens
     SET agente_id = v_agente,
         status = CASE WHEN status::text IN ('liberada','pendente') THEN 'distribuida'::status_ordem ELSE status END,
         distribuida_em = coalesce(distribuida_em, now()),
         aceita_em = coalesce(aceita_em, now())
   WHERE id = _ordem AND (agente_id IS NULL OR agente_id = v_agente);
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN RAISE EXCEPTION 'Esta operação já foi assumida por outro agente'; END IF;

  SELECT id INTO v_dist FROM public.distribuicoes WHERE ordem_id = _ordem;
  IF v_dist IS NOT NULL THEN
    UPDATE public.distribuicoes
       SET agente_id = v_agente, status = 'aceita', aceita_em = now(), atualizado_em = now()
     WHERE id = v_dist AND status NOT IN ('concluida','cancelada');
    PERFORM public.registrar_evento_distribuicao(v_dist, 'Operação aceita pelo agente',
      coalesce((SELECT nome FROM public.agentes WHERE id = v_agente), ''), false,
      jsonb_build_object('agente_id', v_agente));
  END IF;

  INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
  VALUES (_ordem, coalesce((SELECT nome FROM public.agentes WHERE id = v_agente), 'Agente'),
          'Operação aceita pelo agente', '');

  RETURN _ordem;
END $function$;

REVOKE ALL ON FUNCTION public.aceitar_ordem(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.aceitar_ordem(uuid) TO authenticated;