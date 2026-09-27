# Checklist de testes ponta a ponta — Distribuição automática

Objetivo: garantir que o cadastro de uma motocicleta gere e distribua vistoria e
recolhimento de forma correta, única, rastreável e à prova de erro do operador.

Marque cada caso ao validar. Todos os comandos de conferência estão em
`docs/testes-distribuicao.sql` (executar como central/administrador).

## Preparação

- [ ] Existem pelo menos 3 agentes ativos, sendo 1 na mesma cidade da locadora de teste.
- [ ] A locadora de teste possui tabela de cobrança vigente com os serviços de vistoria e coleta.
- [ ] Existe um usuário de cada perfil disponível: central, locadora e agente.
- [ ] Anotar placa de teste única (ex.: `TST0A01`) para isolar os registros.

---

## 1. Criação automática (caminho feliz)

- [ ] Cadastrar uma moto nova pela tela **Motos e prazos**.
- [ ] Conferir que foram criadas exatamente **duas** distribuições: `vistoria` e `recolhimento`.
- [ ] Cada uma tem agente sorteado, `origem = automatica`, `status = notificada`.
- [ ] `servico_nome`, `valor_cobranca` e `valor_pagamento` vieram da tabela vigente (snapshot).
- [ ] A operação correspondente (ordem/vistoria) existe e está vinculada pelo `ordem_id`/`vistoria_id`.
- [ ] O agente sorteado recebeu notificação (registro em `notificacoes` e push, se assinado).
- [ ] A linha do tempo (`distribuicao_eventos`) contém o evento de criação com `automatico = true`.

## 2. Snapshot financeiro imune a mudanças

- [ ] Alterar o valor do serviço na tabela de remuneração **depois** da distribuição.
- [ ] Conferir que `valor_cobranca` e `valor_pagamento` da distribuição **não mudaram**.
- [ ] Conferir que o financeiro (a receber da locadora / a pagar do agente) usa o valor congelado.

## 3. Concorrência e idempotência

- [ ] Cadastrar a mesma moto duas vezes em paralelo (duas abas, salvar quase junto).
- [ ] Resultado: a segunda tentativa é rejeitada por duplicidade de placa; nenhuma distribuição extra.
- [ ] Disparar o gatilho duas vezes para a mesma moto/gatilho/tipo (script SQL de concorrência).
- [ ] Resultado: o índice único `distribuicoes_evento_unico` impede a segunda linha — **1 registro por tipo**.
- [ ] Dois agentes tentando aceitar a mesma distribuição: apenas o agente atual consegue; o outro recebe erro.
- [ ] Aceitar e recusar quase simultaneamente: o estado final é único e coerente (sem `aceita` + `recusada`).
- [ ] Nenhum evento duplicado na linha do tempo após as tentativas concorrentes.

## 4. Falha de notificação

- [ ] Remover/expirar a assinatura push do agente sorteado e cadastrar nova moto.
- [ ] Resultado: a distribuição **é criada mesmo assim** (falha de aviso nunca bloqueia a operação).
- [ ] O erro fica registrado em `push_notification_logs`; a notificação interna continua visível no app.
- [ ] Usar **Reenviar aviso** na tela de Distribuição automática e confirmar novo envio + evento no histórico.
- [ ] Com endpoint de despacho ausente, o cadastro continua funcionando e o log registra o motivo.

## 5. Recusa pelo agente

- [ ] Agente abre o app, vê o card de oferta e recusa **sem motivo**: o sistema exige o motivo.
- [ ] Recusar com motivo: a distribuição sai da lista do agente imediatamente.
- [ ] O sistema **sorteia outro agente na hora** e o antigo não volta a ser sorteado para essa operação.
- [ ] Registro em `distribuicao_recusas` (único por distribuição + agente) e evento no histórico.
- [ ] Todos os elegíveis recusaram: a distribuição fica em situação de espera e a central é avisada — nada some.
- [ ] O agente que recusou não enxerga mais a operação no app.

## 6. Redistribuição pela central

- [ ] Redistribuir escolhendo um agente específico: o agente novo assume e é notificado.
- [ ] Redistribuir sem escolher agente: o sistema sorteia outro elegível, ignorando quem já recusou.
- [ ] A distribuição anterior fica marcada como `redistribuida`/histórico preservado — nenhuma linha apagada.
- [ ] Motivo obrigatório é exigido e aparece no histórico com o nome de quem executou.
- [ ] Redistribuir depois do início em campo: o sistema bloqueia ou exige cancelamento explícito, sem perder evidências.
- [ ] Valores permanecem os do snapshot, salvo alteração explícita de valor pela central.

## 7. Bloqueio de alterações pelo agente

- [ ] Agente tenta alterar valor da operação (via app ou chamada direta): **negado**.
- [ ] Agente tenta trocar o serviço: **negado**.
- [ ] Agente tenta trocar o agente principal ou se atribuir uma operação de outro: **negado**.
- [ ] Agente tenta aceitar/recusar distribuição que não é dele: **negado**.
- [ ] Agente só consegue: aceitar, recusar com motivo e definir/remover o auxiliar.
- [ ] Auxiliar recebe exatamente o mesmo repasse do principal; auxiliar não pode ser o próprio principal.
- [ ] Locadora não enxerga nem altera dados de distribuição de outras locadoras (RLS).

## 8. Execução, conclusão e financeiro

- [ ] Aceite → deslocamento → chegada → evidências → conclusão: cada trava do fluxo continua valendo.
- [ ] Ao entrar em campo, a distribuição passa a `em_execucao`; ao concluir, a `concluida`.
- [ ] Conclusão gera conta a receber da locadora e conta a pagar do agente (principal e auxiliar).
- [ ] Cancelar a distribuição: operação vinculada é cancelada/estornada de forma coerente, sem valor órfão.
- [ ] Nenhum valor fica preso: toda linha do financeiro tem origem rastreável até a distribuição.

## 9. Auditoria

- [ ] Toda ação administrativa (redistribuir, alterar serviço, alterar valor, cancelar) exige motivo.
- [ ] Histórico mostra ação, motivo, autor e data — e nada pode ser editado ou apagado.
- [ ] Eventos automáticos aparecem identificados como do sistema.

## Presença real dos agentes (disponibilidade)

Janela de presença: 90 s. Sinal do aplicativo: 30 s.

1. Agente OFFLINE → não entra no sorteio (`descartados` registra "offline").
2. Agente ONLINE com internet → recebe ordem normalmente.
3. Agente ONLINE que perde internet → após 90 s sem sinal sai do sorteio ("conexão perdida").
4. Conexão volta → o app reenvia o sinal e o agente volta a ser elegível.
5. Ordem em andamento + queda de conexão → a ordem continua com o agente, sem cancelamento.
6. Agente com operação `distribuida`/`em_andamento` → não recebe nova ordem ("ocupado com outra operação").
7. App fechado → o carimbo envelhece e a presença expira sozinha.
8. App reaberto → presença restaurada só depois da confirmação do servidor.
9. Dois administradores distribuindo ao mesmo tempo → `pg_advisory_xact_lock` serializa o sorteio e a regra de "ocupado" impede dupla atribuição.

## Placa e novas capturas

10. Mesma placa com vários recolhimentos → todos permanecem acessíveis e independentes.
11. Nova ordem com placa já usada → permitida (a duplicidade só avisa quando há ocorrência **aberta**, e ainda assim há "Criar mesmo assim").
12. Nova ordem com marca/modelo/cor diferentes do histórico → permitida, com aviso no importador; o histórico anterior não é alterado.
