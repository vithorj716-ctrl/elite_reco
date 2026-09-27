DO $$
DECLARE
  v_loc uuid; v_ordem uuid; v_ag uuid; v_status text; v_ok boolean;
BEGIN
  PERFORM set_config('app.distribuicao','1',true);
  INSERT INTO locadoras (nome, cnpj, cidade, uf, ativa) VALUES ('TESTE FLUXO','00000000000000','Curitiba','PR',true) RETURNING id INTO v_loc;
  INSERT INTO agentes (nome, telefone, cidade, ativo, online, cidades_atendidas)
    VALUES ('TESTE AGENTE','41999999999','Curitiba',true,true, ARRAY['Curitiba']) RETURNING id INTO v_ag;

  -- 1) nasce aguardando definicao
  INSERT INTO ordens (locadora_id, placa, criada_em) VALUES (v_loc,'TST1A23', now()) RETURNING id, status::text INTO v_ordem, v_status;
  IF v_status <> 'pendente_definicao' THEN RAISE EXCEPTION 'T1 falhou: status %', v_status; END IF;

  -- 8) distribuir antes da liberacao deve falhar
  BEGIN
    UPDATE ordens SET status='distribuida', agente_id=v_ag WHERE id=v_ordem;
    RAISE EXCEPTION 'T8 falhou: distribuiu sem liberacao';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'T8 falhou%' THEN RAISE; END IF;
  END;

  -- 7) designar agente antes da liberacao deve falhar
  BEGIN
    UPDATE ordens SET agente_id=v_ag WHERE id=v_ordem;
    RAISE EXCEPTION 'T7 falhou: designou agente sem liberacao';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'T7 falhou%' THEN RAISE; END IF;
  END;

  -- 9) liberar sem valor final deve falhar
  BEGIN
    UPDATE ordens SET status='liberada', liberado_em=now() WHERE id=v_ordem;
    RAISE EXCEPTION 'T9 falhou: liberou sem valores';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'T9 falhou%' THEN RAISE; END IF;
  END;

  -- liberacao correta congela valores
  UPDATE ordens SET status='liberada', valor_cobranca_base=100, valor_cobranca_adicional=20, valor_cobranca_final=120,
    valor_pagamento_base=60, valor_pagamento_adicional=10, valor_pagamento_final=70,
    definido_em=now(), liberado_em=now() WHERE id=v_ordem;
  SELECT status::text INTO v_status FROM ordens WHERE id=v_ordem;
  IF v_status <> 'liberada' THEN RAISE EXCEPTION 'T-liberacao falhou: %', v_status; END IF;

  -- distribuicao agora permitida
  UPDATE ordens SET status='distribuida', agente_id=v_ag, distribuida_em=now() WHERE id=v_ordem;
  SELECT valor_cobranca_final=120 AND valor_pagamento_final=70 INTO v_ok FROM ordens WHERE id=v_ordem;
  IF NOT v_ok THEN RAISE EXCEPTION 'T5 falhou: valores congelados mudaram'; END IF;

  -- 2) horario especial pelo momento da criacao
  INSERT INTO ordens (locadora_id, placa, criada_em) VALUES (v_loc,'TST2B34', (current_date + time '18:10') AT TIME ZONE 'America/Sao_Paulo') RETURNING id INTO v_ordem;
  SELECT horario_especial INTO v_ok FROM ordens WHERE id=v_ordem;
  IF NOT v_ok THEN RAISE EXCEPTION 'T2 falhou: horario especial nao marcado'; END IF;

  INSERT INTO ordens (locadora_id, placa, criada_em) VALUES (v_loc,'TST3C45', (current_date + time '16:30') AT TIME ZONE 'America/Sao_Paulo') RETURNING id INTO v_ordem;
  SELECT horario_especial INTO v_ok FROM ordens WHERE id=v_ordem;
  IF v_ok THEN RAISE EXCEPTION 'T3 falhou: marcou horario especial as 16:30'; END IF;

  DELETE FROM distribuicao_eventos WHERE distribuicao_id IN (SELECT id FROM distribuicoes WHERE locadora_id=v_loc);
  DELETE FROM distribuicoes WHERE locadora_id=v_loc;
  DELETE FROM notificacoes WHERE ordem_id IN (SELECT id FROM ordens WHERE locadora_id=v_loc);
  DELETE FROM ordem_historico WHERE ordem_id IN (SELECT id FROM ordens WHERE locadora_id=v_loc);
  DELETE FROM ordens WHERE locadora_id=v_loc;
  DELETE FROM agentes WHERE id=v_ag;
  DELETE FROM locadoras WHERE id=v_loc;
  RAISE NOTICE 'TODOS OS TESTES PASSARAM';
END $$;