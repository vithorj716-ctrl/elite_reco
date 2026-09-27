-- Transferência de responsabilidade de uma ordem entre agentes.
-- Toda a autoridade fica no banco: só equipe operacional (super_admin/operador)
-- executa; o histórico é apenas acrescentado, nunca reescrito.
create or replace function public.transferir_ordem_agente(
  _ordem uuid,
  _agente uuid,
  _motivo text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- trava a linha: decide sobre o responsável atual, nunca sobre estado do navegador
  select * into o from public.ordens where id = _ordem for update;
  if not found then
    raise exception 'Ordem não encontrada';
  end if;

  if o.status in ('concluida','cancelada') then
    raise exception 'Ordem % está % e não pode ser transferida pelo fluxo operacional', o.codigo, o.status;
  end if;
  if o.recebimento_pago or o.pagamento_pago then
    raise exception 'Ordem % já está faturada ou paga. Estorne a liquidação antes de transferir.', o.codigo;
  end if;
  if _agente is null then
    raise exception 'Escolha o novo agente responsável';
  end if;
  if o.agente_id is not null and o.agente_id = _agente then
    raise exception 'Este agente já é o responsável pela ordem %', o.codigo;
  end if;

  select nome into v_novo from public.agentes where id = _agente and ativo;
  if v_novo is null then
    raise exception 'O novo agente precisa estar cadastrado e ativo';
  end if;
  select nome into v_anterior from public.agentes where id = o.agente_id;

  select coalesce(nullif(p.nome,''), nullif(p.email,''), 'operador')
    into v_quem from public.profiles p where p.id = v_uid;
  v_quem := coalesce(v_quem, 'operador');

  update public.ordens set
    agente_id = _agente,
    -- auxiliar não pode ser a mesma pessoa do principal
    agente_auxiliar_id = case when agente_auxiliar_id = _agente then null else agente_auxiliar_id end,
    -- pendente passa a distribuída; em execução preserva status e marcos de campo
    status = case when status = 'pendente' then 'distribuida'::status_ordem else status end,
    distribuida_em = now(),
    -- o novo responsável precisa aceitar quando a rota ainda não começou
    aceita_em = case when status = 'distribuida' then null else aceita_em end
  where id = _ordem;

  insert into public.ordem_historico (ordem_id, quem, acao, detalhe)
  values (
    _ordem, v_quem, 'Ordem transferida',
    'Agente anterior: ' || coalesce(v_anterior, 'sem agente') ||
    ' · Novo agente: ' || v_novo ||
    ' · Situação na transferência: ' || o.status::text ||
    case when o.status = 'em_andamento' then ' (rota já iniciada — marcos de campo preservados)' else '' end ||
    coalesce(' · Motivo: ' || nullif(btrim(_motivo), ''), '')
  );

  insert into public.auditoria (entidade, registro_id, acao, quem, quem_nome, dados)
  values ('ordens', _ordem, 'alterou', v_uid, v_quem,
    jsonb_build_object(
      'acao', 'transferencia_de_agente',
      'codigo', o.codigo,
      'placa', o.placa,
      'status', o.status,
      'agente_anterior', o.agente_id,
      'agente_anterior_nome', v_anterior,
      'agente_novo', _agente,
      'agente_novo_nome', v_novo,
      'motivo', btrim(coalesce(_motivo,''))
    ));

  return _ordem;
end;
$$;

revoke all on function public.transferir_ordem_agente(uuid, uuid, text) from public;
grant execute on function public.transferir_ordem_agente(uuid, uuid, text) to authenticated;

-- Edição cadastral do agente por parte da equipe, sem tocar em IDs ou vínculos.
create or replace function public.atualizar_cadastro_agente(
  _agente uuid,
  _nome text,
  _telefone text,
  _cidade text,
  _situacao text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quem text;
  v_antes public.agentes%rowtype;
begin
  if not public.equipe(v_uid) then
    raise exception 'Somente a equipe operacional pode editar o cadastro do agente';
  end if;
  if btrim(coalesce(_nome,'')) = '' then
    raise exception 'Informe o nome do agente';
  end if;
  if _situacao not in ('ativo','inativo','bloqueado') then
    raise exception 'Situação inválida para o agente';
  end if;

  select * into v_antes from public.agentes where id = _agente for update;
  if not found then raise exception 'Agente não encontrado'; end if;

  update public.agentes set
    nome = btrim(_nome),
    telefone = coalesce(_telefone, telefone),
    cidade = coalesce(_cidade, cidade),
    situacao = _situacao,
    ativo = (_situacao = 'ativo')
  where id = _agente;

  select coalesce(nullif(p.nome,''), nullif(p.email,''), 'operador')
    into v_quem from public.profiles p where p.id = v_uid;

  insert into public.auditoria (entidade, registro_id, acao, quem, quem_nome, dados)
  values ('agentes', _agente, 'alterou', v_uid, coalesce(v_quem,'operador'),
    jsonb_build_object(
      'antes', jsonb_build_object('nome', v_antes.nome, 'telefone', v_antes.telefone,
                                  'cidade', v_antes.cidade, 'situacao', v_antes.situacao),
      'depois', jsonb_build_object('nome', btrim(_nome), 'telefone', _telefone,
                                   'cidade', _cidade, 'situacao', _situacao)
    ));
end;
$$;

revoke all on function public.atualizar_cadastro_agente(uuid, text, text, text, text) from public;
grant execute on function public.atualizar_cadastro_agente(uuid, text, text, text, text) to authenticated;