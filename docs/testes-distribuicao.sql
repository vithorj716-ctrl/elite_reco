-- Conferências do checklist de distribuição automática (docs/testes-distribuicao.md).
-- Executar como central/administrador. Trocar 'TST0A01' pela placa de teste.

-- 1. Criação automática: deve retornar exatamente 2 linhas (vistoria e recolhimento).
select d.tipo, d.status, d.origem, d.servico_nome, d.valor_cobranca, d.valor_pagamento,
       a.nome as agente, d.regra, jsonb_array_length(d.elegiveis) as elegiveis
  from public.distribuicoes d
  left join public.agentes a on a.id = d.agente_id
 where d.moto_id = (select id from public.motos where placa = 'TST0A01');

-- 1b. Vínculo com a operação criada.
select d.tipo, d.ordem_id, d.vistoria_id, o.codigo as ordem, v.codigo as vistoria
  from public.distribuicoes d
  left join public.ordens o on o.id = d.ordem_id
  left join public.vistorias v on v.id = d.vistoria_id
 where d.moto_id = (select id from public.motos where placa = 'TST0A01');

-- 3. Idempotência: nunca pode haver mais de uma distribuição por moto+gatilho+tipo.
select moto_id, gatilho, tipo, count(*)
  from public.distribuicoes
 where moto_id is not null
 group by 1,2,3
having count(*) > 1;   -- esperado: nenhuma linha

-- 3b. Estado incoerente (aceita e recusada ao mesmo tempo).
select id, status, aceita_em, recusada_em
  from public.distribuicoes
 where aceita_em is not null and recusada_em is not null;   -- esperado: nenhuma linha

-- 4. Falha de notificação: erros registrados, sem bloquear a criação.
select status, erro, enviado_em
  from public.push_notification_logs
 order by enviado_em desc
 limit 20;

-- 5. Recusas: uma linha por agente, sem repetição.
select r.distribuicao_id, a.nome, r.motivo, r.criada_em
  from public.distribuicao_recusas r
  join public.agentes a on a.id = r.agente_id
 order by r.criada_em desc
 limit 20;

-- 5b. O agente que recusou não pode voltar a ser o responsável.
select d.id, a.nome as agente_atual
  from public.distribuicoes d
  join public.distribuicao_recusas r
    on r.distribuicao_id = d.id and r.agente_id = d.agente_id
  join public.agentes a on a.id = d.agente_id;   -- esperado: nenhuma linha

-- 6/9. Linha do tempo completa de uma distribuição.
select e.quando, e.acao, e.detalhe, e.automatico, e.quem_nome
  from public.distribuicao_eventos e
 where e.distribuicao_id = '<id-da-distribuicao>'
 order by e.quando;

-- 8. Financeiro: distribuição concluída sem lançamento correspondente.
select d.id, d.tipo, d.status, d.valor_cobranca, d.valor_pagamento
  from public.distribuicoes d
 where d.status = 'concluida'
   and not exists (
     select 1 from public.lancamentos_agente l
      where l.ordem_id = d.ordem_id
   )
   and d.ordem_id is not null;   -- esperado: nenhuma linha

-- Limpeza do cenário de teste (opcional, só em ambiente de homologação).
-- delete from public.motos where placa = 'TST0A01';
