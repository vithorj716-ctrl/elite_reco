# Integridade estrutural: catálogo de serviços, tabelas de preço e vínculo da locadora

Varredura concluída. Boa parte do escopo já está implementada e será apenas verificada; o que sobrou é estrutural e concentra-se no catálogo de serviços.

## O que já está correto hoje (verificado no código e no banco)

- **Fonte de verdade**: não existe backend local. `localStorage` só guarda o e-mail lembrado na tela de entrar. Leitura única em `banco.repo.ts`, escrita nos services, Realtime em `providers/dados.tsx` com invalidação granular.
- **Agente principal e auxiliar**, snapshot de valores por ordem (`valor_cobranca`, `valor_pagamento_principal`, `valor_pagamento_auxiliar`, `quantidade_km`), travas de deslocamento/chegada no app e no banco (`ordens_regras`), rastreamento por Host com PIN copiável, telefone abrindo WhatsApp, evidências isoladas por locadora, checklist sem "Documentação", adiantamentos com editar/excluir/cancelar/estornar.

## Problemas reais encontrados

1. **Catálogo de serviços é um enum fixo** (`tipo_servico` no banco + `TipoServico` no TypeScript) com 14 valores, incluindo os antigos `captura_normal`, `captura_dificil`, `busca_especial`, `recolhimento_urbano` etc. As linhas das tabelas usam esse código como texto (`itens_remuneracao.codigo`), sem relacionamento real.
2. **A locadora não referencia a tabela que usa**. A vinculação hoje é uma busca por `locadora_id` na tabela de cobrança — funciona, mas não é integridade referencial e impede reaproveitar a tabela padrão.
3. **A seleção de serviço mostra o catálogo global**, não os serviços da tabela da locadora.
4. **Tabela legada `precos`** continua existindo e sendo lida pelo repositório, em paralelo ao modelo novo.
5. Ordens antigas (6 registros) ainda usam `captura_normal`/`busca_especial`, sem correspondência nas tabelas — por isso aparecem sem valor.

## O que será feito

### Banco (uma migração, sem perda de dados)

- Nova tabela `servicos`: nome, descrição, unidade de cobrança, ativo, datas. Semeada com Coleta Padrão (R$ 100), Coleta Externa (R$ 200), Viagem Especial (R$ 3,50/km), Limpeza da Moto e Escapamento.
- `itens_remuneracao.servico_id` referenciando `servicos`, preenchido a partir do `codigo` atual. `codigo` permanece por compatibilidade e deixa de ser a chave.
- `ordens.servico_id` referenciando `servicos`, preenchido a partir de `tipo_servico`; os serviços antigos (`captura_normal`, `busca_especial`, ...) viram registros inativos do catálogo, para que o histórico continue legível sem poluir novas seleções. O enum permanece na coluna antiga apenas como histórico.
- `locadoras.tabela_cobranca_id` referenciando `tabelas_remuneracao`, apontando para a tabela própria já existente ou para a padrão. O gatilho de herança passa a gravar essa referência.
- GRANTs e políticas para as novas tabelas/colunas; sem tocar em dados reais.

### Código

- `src/domain/types`: entidade `Servico`; `Ordem` e `ItemRemuneracao` passam a carregar `servicoId`; `TipoServico` fica reduzido a tipo de leitura do histórico.
- `banco.repo.ts`: carrega `servicos`, entra no Realtime; leitura da tabela legada `precos` removida.
- `src/domain/services/remuneracao.ts`: resolução por `servicoId` e pela tabela vinculada à locadora, com queda para a padrão; remoção do caminho legado.
- Novo `src/services/servicos.service.ts` (CRUD do catálogo) e ajuste em `remuneracao.service.ts` para itens por serviço.
- `locadoras.service.ts`: grava e troca a tabela vinculada.
- Distribuição e criação de ordem (`ordens/index.tsx`, `ordens/$id.tsx`, `portal.tsx`, importador): a lista de serviços passa a vir **da tabela vinculada à locadora selecionada**, só itens ativos.
- Editor de tabelas: escolher serviço do catálogo ao adicionar linha, editar valor/descrição/unidade, ativar, desativar, duplicar, ordenar — campos de valor em texto com máscara, sem setas.
- Nova aba de administração do catálogo de serviços dentro da tela de tabelas, mantendo a identidade visual atual.

### Validação

Percorrer os testes 1 a 14 do documento no preview autenticado, com foco em: serviços restritos à locadora, alteração de tabela isolada por locadora, ordens antigas com valor congelado intacto, financeiro dos dois agentes, ciclo do adiantamento e propagação em tempo real. Relatório técnico final ao fim.

## Observação

A interface, as animações e os componentes atuais são preservados; as mudanças de tela se limitam à origem dos dados e ao editor de tabelas.
