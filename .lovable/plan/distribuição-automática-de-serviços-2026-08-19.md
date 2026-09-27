# Distribuição automática de serviços

Quando a locadora cadastra uma motocicleta, o sistema cria sozinho as operações (uma vistoria e um recolhimento), congela serviço e valores da tabela do administrador, sorteia um agente principal elegível, notifica só ele e registra toda a decisão. O administrador continua com autoridade total para redistribuir, trocar agente, trocar serviço, corrigir valor ou cancelar — sempre com auditoria.

## Decisões já definidas

- Cada moto nova gera **duas** operações: vistoria e recolhimento.
- Recusa do agente → novo sorteio automático entre os elegíveis restantes; esgotando os elegíveis, a operação volta para `aguardando_distribuicao` e a central é notificada.
- O auxiliar recebe **o mesmo valor do principal** (o valor da tabela de pagamento do serviço, para cada um).

## 1. Onde a automação vive

A regra fica no banco (função `SECURITY DEFINER` + gatilho no cadastro de moto), não no React. Assim funciona mesmo se a moto for criada pelo portal da locadora, pela central ou por importação, e é imune a clique duplo, retry e recarregamento de página.

```text
LOCADORA CADASTRA MOTO
  -> gatilho após inserção
  -> distribuir_moto(moto)  [transação única]
       cria vistoria + ordem
       escolhe serviço ativo na tabela da locadora (fallback padrão)
       congela valor de cobrança e de pagamento
       lista agentes elegíveis, sorteia o principal
       grava a distribuição + linha do tempo
       envia notificação só ao sorteado
```

## 2. Novas estruturas de dados

- `distribuicoes` — uma linha por operação distribuída: tipo (`vistoria` | `recolhimento`), id da operação, moto, locadora, serviço, snapshot (`servico_nome`, `valor_cobranca`, `valor_pagamento`), agente principal, auxiliar, status, origem (`automatica` | `manual` | `redistribuida`), regra aplicada, agentes elegíveis do sorteio (com motivo de exclusão de cada descartado), datas.
  - Chave única `(moto_id, gatilho, tipo)` impede duas distribuições para o mesmo evento.
  - Chave única no id da operação impede dois agentes principais/duas cobranças para a mesma operação.
- `distribuicao_eventos` — linha do tempo permanente (criação, seleção de serviço, sorteio, notificação, aceite, recusa, auxiliar, troca, alteração de valor, cancelamento, conclusão), marcando `automatico`/`manual` e o responsável.
- `distribuicao_recusas` — quem recusou e por quê; alimenta o novo sorteio.
- Colunas novas em `vistorias`: `agente_auxiliar_id`, `valor_pagamento_principal`, `valor_pagamento_auxiliar` (recolhimentos já têm).

Estados: `aguardando_distribuicao`, `distribuida`, `notificada`, `aceita`, `recusada`, `em_execucao`, `concluida`, `cancelada`, `redistribuida`.

## 3. Regras de seleção

- **Serviço**: só de `servicos` ativos, precificados pela tabela da locadora e, na falta, pela tabela padrão. Vistoria usa o serviço de vistoria; recolhimento usa o serviço de coleta padrão. Sem preço válido, a operação nasce `aguardando_distribuicao` e avisa a central — nunca nasce operação financeira incompleta.
- **Agente**: sorteio real (`random()`) entre agentes ativos, não bloqueados, com situação liberada e que atendam a cidade da locadora; quem recusou aquela operação fica de fora. Cada descartado é registrado com o motivo.
- **Sem agente elegível**: operação fica `aguardando_distribuicao` e a central recebe notificação; a central distribui manualmente ou reprocessa depois, sem duplicar.

## 4. Financeiro

O valor sai da tabela do administrador e é congelado na distribuição, nos campos de snapshot já existentes das operações. Alteração posterior da tabela não mexe em operação já distribuída. Auxiliar entra com o mesmo valor do principal, vinculado à operação — os lançamentos continuam apontando para a operação de origem, sem lançamento solto.

## 5. Ações e permissões (garantidas no banco)

Agente principal (via funções `SECURITY DEFINER`, RLS bloqueando o resto):
- aceitar, recusar (com motivo), executar, escolher auxiliar entre os elegíveis.
- não altera serviço, valor, agente principal nem qualquer dado financeiro.

Administrador:
- redistribuir, trocar agente, alterar serviço, alterar valor (com motivo obrigatório), adicionar/remover auxiliar, corrigir lançamento, cancelar distribuição.
- toda ação exige confirmação, grava valor anterior e novo, responsável, data/hora e motivo; o histórico anterior nunca é apagado.

## 6. Telas

- **Novo menu "Distribuição"** (central): indicadores por status (aguardando, distribuídas, aceitas, em execução, concluídas, recusadas, redistribuídas), filtros por locadora, agente, serviço, status, período e origem, e destaque das operações alteradas manualmente.
- **Ficha da operação** (recolhimento e vistoria): bloco "Distribuição" com origem (`Distribuição automática` / `Manual` / `Redistribuída pelo administrador`), serviço, valor, principal, auxiliar, status, linha do tempo completa e os botões administrativos.
- **App do agente**: card "Nova operação" com serviço, moto, placa e local; botões Aceitar/Recusar; após aceitar, "Adicionar auxiliar" com a lista de elegíveis. Valor sempre visível e somente leitura.
- Notificações reutilizam a infraestrutura atual (push + sino), enviadas apenas ao agente da vez; troca de agente notifica o novo e encerra o acesso do anterior.

## Detalhes técnicos

- Migração: enums e tabelas acima, GRANTs, RLS (agente vê só as próprias; locadora vê as suas; equipe vê tudo), índices únicos de idempotência, funções `distribuir_moto`, `sortear_agente`, `aceitar_distribuicao`, `recusar_distribuicao`, `definir_auxiliar`, `admin_redistribuir`, `admin_trocar_agente`, `admin_alterar_servico`, `admin_alterar_valor`, `admin_cancelar_distribuicao`, todas gravando em `distribuicao_eventos` e em `auditoria`. Locks (`FOR UPDATE`) e `ON CONFLICT DO NOTHING` garantem atomicidade contra concorrência.
- Código: `src/services/distribuicao.service.ts` (chama as RPCs), `src/domain/services/distribuicao.ts` (rótulos/estado), tipos em `src/domain/types`, leitura no `banco.repo.ts` e mapeadores, rota `src/routes/_app/distribuicao.tsx`, componentes `distribuicao-operacao.tsx` (bloco + ações admin) e `oferta-agente.tsx` (aceite/recusa/auxiliar), item de menu no `shell.tsx`.
- Compatibilidade: operações antigas continuam funcionando sem linha de distribuição; nada do fluxo atual de campo, financeiro ou vistorias é removido.

## Validação antes de fechar

Cadastro de moto gerando as duas operações, snapshot de serviço/valor, sorteio variado entre agentes, notificação exclusiva, aceite, recusa com novo sorteio, escolha de auxiliar com valor igual ao principal, tentativa de o agente alterar serviço/valor (deve falhar no banco), as quatro ações administrativas com auditoria, cadastro duplicado/duas requisições simultâneas sem dupla distribuição, ausência de agente elegível e reenvio de notificação falha.
