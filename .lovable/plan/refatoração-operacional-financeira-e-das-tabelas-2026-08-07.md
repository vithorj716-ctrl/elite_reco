# Refatoração operacional, financeira e das tabelas

Objetivo: o sistema passa a representar a operação real — duas tabelas padrão, dupla de agentes por ordem, valores editáveis por ordem, fluxo de campo com travas e adiantamentos totalmente gerenciáveis. Identidade visual, funcionalidades e dados existentes preservados.

## 1. Tabelas padrão de cobrança e pagamento

- Uma única **Tabela Padrão de Cobrança da Locadora** e uma única **Tabela Padrão de Pagamento dos Agentes**, criadas na migração e marcadas como padrão.
- Nova locadora **herda** a tabela padrão de cobrança automaticamente (cópia própria criada no cadastro, editável só para ela). Locadoras já cadastradas continuam funcionando: sem tabela própria, caem na padrão.
- Todos os agentes usam a tabela padrão de pagamento; exceções individuais continuam possíveis (tabela com `agente_id`), mas não são criadas por padrão.
- Fim da divergência admin × locadora: uma única função de resolução de preço passa a ser usada por todas as telas (ficha da ordem, portal da locadora, financeiro, relatórios).

### Serviços iniciais (ambas as tabelas)

| Serviço | Cobrança | Tipo |
| --- | --- | --- |
| Coleta Padrão | R$ 100,00 | fixo |
| Coleta Externa | R$ 200,00 | fixo |
| Viagem Especial | R$ 3,50 | por km (aceita valor fechado) |
| Limpeza da Moto | valor livre | fixo |
| Escapamento | valor livre | fixo |

Os valores de pagamento dos agentes partem da divisão principal/auxiliar definida pelo administrador. Tudo é editável, renomeável, excluível e reordenável.

## 2. Editor de tabelas em modo planilha

Reescrita completa do editor, mantendo o estilo grafite/âmbar:

- linhas editáveis inline (nome, descrição, valor, unidade fixo/km);
- adicionar, duplicar e excluir linha;
- arrastar para reordenar (Dnd Kit) com persistência da posição;
- alternar ativo/inativo;
- salvamento otimista com desfazer via toast;
- valores sempre em campo de texto com máscara monetária — nenhum input com setas.

## 3. Checklist

Remover `Documentação`; adicionar `Limpeza da Moto` e `Escapamento`. Checklists já gravados continuam sendo exibidos como estão.

## 4. Agente Principal e Agente Auxiliar

- Toda ordem passa a ter `agente_id` (principal) e `agente_auxiliar_id`.
- Distribuição exige os dois e impede selecionar o mesmo agente nos dois campos.
- Só o principal enxerga a ordem no aplicativo (política de acesso e filtros do app inalterados para o auxiliar).
- O auxiliar aparece em financeiro, histórico, produtividade, relatórios e estatísticas.
- Ordens antigas sem auxiliar continuam válidas (campo opcional no banco, obrigatório apenas em novas distribuições).

## 5. Pagamento individual por ordem

- Novos campos por ordem: `valor_cobranca`, `valor_pagamento_principal`, `valor_pagamento_auxiliar` (e `quantidade_km` para Viagem Especial).
- Na distribuição o administrador pode sobrescrever os três valores **apenas naquela ordem**; a tabela padrão nunca é alterada.
- Sem sobrescrita, os valores vêm da tabela e são congelados na conclusão.
- Saldos pendente, recebido, disponível, histórico e produtividade passam a ser calculados **por agente**, somando participações como principal e como auxiliar.

## 6. Fluxo obrigatório do agente

Sequência travada: Aceitar → Iniciar Deslocamento → Abrir Rastreamento → Anunciar Chegada → Executar Captura → Enviar Evidências → Concluir.

- "Abrir Rastreamento" bloqueado até iniciar o deslocamento: "Para acessar o rastreamento é obrigatório iniciar o deslocamento."
- Sem "Anunciar Chegada" o sistema bloqueia envio de evidências, mudança de status e conclusão: "Antes de continuar é necessário informar sua chegada ao local."
- As travas valem na interface **e** no banco (gatilho de transição), para não dependerem só do app.

## 7. Adiantamentos

Módulo refeito com o mesmo padrão de gestão dos demais:

- criar, editar, excluir, cancelar, estornar;
- anexar comprovante e observações;
- pesquisa, filtros por agente/período/situação e histórico de alterações;
- adiantamento **não utilizado** pode ser excluído; **já compensado** só por estorno, que gera lançamento reverso rastreável;
- nenhum valor fica preso: toda linha tem uma ação disponível.

## 8. Extrato do agente

Extrato cronológico único por agente com ordens executadas (principal e auxiliar), valores recebidos, pendentes, adiantamentos, estornos, bonificações, descontos e saldo disponível, com filtro por período e exportação/impressão já existente preservada.

## Detalhes técnicos

- **Migração**: colunas `agente_auxiliar_id`, `valor_pagamento_principal`, `valor_pagamento_auxiliar`, `quantidade_km` em `ordens`; `unidade` e `valor_km` em `itens_remuneracao`; coluna de situação/estorno em `lancamentos_agente`; seed das duas tabelas padrão com os cinco serviços; GRANTs e políticas para os novos campos; atualização de `ordens_regras()` para validar dupla de agentes, travas de chegada/deslocamento e congelamento dos dois valores de pagamento; gatilho de herança da tabela de cobrança ao inserir locadora.
- **Domínio**: `src/domain/types`, `src/domain/services/remuneracao.ts` (resolução única de preço, suporte a km) e `src/domain/services/financeiro.ts` (saldo por agente somando principal + auxiliar).
- **Serviços**: `ordens.service.ts` (distribuição com dois agentes e valores por ordem, transições de campo), `remuneracao.service.ts` (unidade/km, reordenação), `lancamentos.service.ts` (editar, excluir, cancelar, estornar), `locadoras.service.ts` (herança da tabela).
- **Interface**: `tabelas-remuneracao.tsx` (planilha com Dnd Kit), `financeiro-ordem.tsx`, `acoes-ordem.tsx`, ficha da ordem, `painel-campo.tsx` e app do agente (travas), `movimentacoes.tsx` e extrato do agente.
- Compatibilidade: todos os campos novos são opcionais no banco; leituras antigas mantêm fallback para o comportamento atual.

## Validação antes de fechar

Tabelas padrão e herança em nova locadora, cálculo de cobrança e dos dois pagamentos (incluindo Viagem Especial por km), obrigatoriedade e distinção dos agentes, sobrescrita de valores na distribuição sem afetar a tabela, cada trava do fluxo de campo, ciclo completo de adiantamento (criar, editar, excluir, compensar, estornar) e conferência dos extratos dos dois agentes de uma mesma ordem. Ao final, relatório com módulos alterados, regras criadas e removidas, tabelas refatoradas, testes e validações realizadas.
