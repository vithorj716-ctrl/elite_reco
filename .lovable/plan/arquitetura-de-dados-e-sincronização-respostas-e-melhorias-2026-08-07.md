## Arquitetura de Dados e Sincronização — Respostas e Melhorias

Este plano documenta, com base no código atual, onde vivem cada uma das camadas que você perguntou. Também propõe duas melhorias pequenas para deixar o sistema mais previsível.

### 1. Camada de acesso aos dados

A leitura centralizada está em **`src/domain/repositories/banco.repo.ts`** (`carregarBanco()`). Ele é o único ponto que conhece o Supabase: faz ~18 `SELECT` paralelos, converte as linhas em entidades do domínio (`paraOrdem`, `paraAgente`, etc.) e devolve um objeto `Banco` tipado. Telas e serviços consomem esse objeto, não as tabelas crus.

As escritas ficam em **`src/services/`** (ex: `ordens.service.ts`, `evidencias.service.ts`, `locadoras.service.ts`). Cada serviço encapsula as regras de negócio e chama o Supabase. A política de erro centralizada vive em **`src/data/erros.ts`** (`conferirErro`, `traduzirErro`).

### 2. Configuração do Supabase

O cliente do browser é gerado automaticamente em **`src/integrations/supabase/client.ts`** (não deve ser editado). Ele lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` e persiste a sessão no `localStorage`.

Para funções de servidor autenticadas, o projeto usa **`requireSupabaseAuth`** em **`src/integrations/supabase/auth-middleware.ts`**, que valida o bearer token e injeta `context.supabase` + `userId` no handler. Operações privilegiadas usam `supabaseAdmin` via **`src/integrations/supabase/client.server.ts`** (carregado só dentro de handlers).

### 3. Queries e mutations

- **Queries**: a maioria das telas usa `useBanco()` (do contexto) ou `useQuery` com a chave `["banco"]`. Isso evita que cada componente faça seu próprio fetch.
- **Mutations**: as alterações são funções síncronas nos services (`OrdensService.atualizar`, `EvidenciasService.enviar`, etc.) que, após sucesso, chamam `useSincronizar()` (`queryClient.invalidateQueries({ queryKey: ["banco"] })`) para refazer a leitura global.

### 4. Sincronização entre usuários

A sincronização é feita por **Supabase Realtime** em **`src/providers/dados.tsx`**:

- O componente `ProvedorDados` abre um canal em tempo real que escuta todas as tabelas operacionais listadas em `TABELAS_REALTIME` (em `banco.repo.ts`).
- Qualquer insert/update/delete dispara `queryClient.invalidateQueries({ queryKey: ["banco"] })`, forçando `carregarBanco()` a rodar novamente.
- Há reconexão automática com backoff e fallback de polling a cada 15s quando o canal cai.
- A renovação do token do socket é tratada no `onAuthStateChange` quando a sessão é renovada.

### 5. Envio de imagens ao Storage

O upload acontece em **`src/services/evidencias.service.ts`** (`EvidenciasService.enviar`):

- O arquivo é enviado ao bucket privado `evidencias` no caminho `locadoras/{locadoraId}/ordens/{ordemId}/evidencias/{tipo}/{arquivo}`.
- Depois do upload, uma linha é inserida em `public.ordem_evidencias` com metadados (tipo, etapa, GPS, observação, etc.).
- Para visualização, `EvidenciasService.link` gera uma URL assinada temporária (padrão 1h).
- As fotos antigas (`ordem_fotos`) ainda existem, mas o fluxo novo usa evidências.

### 6. Atualização das listas após uma alteração

Hoje o padrão é **global**: a mutation invalida a chave `["banco"]`, e `ProvedorDados` recarrega tudo. Isso é simples e garante consistência, mas recarrega ~18 tabelas a cada ação. As listas individuais derivam o estado de `useBanco()`.

### Propostas de melhoria (opcional)

1. **Cache granular por entidade**: manter `["banco"]` como snapshot, mas adicionar chaves secundárias (`["ordens"]`, `["agentes"]`, etc.) para invalidações cirúrgicas. Isso reduziria o tráfego quando apenas uma ordem muda.
2. **Documentação em diagrama**: gerar um diagrama simples (texto ou ASCII) mostrando o fluxo `Tela → Service → Supabase → Realtime → ProvedorDados → Tela` para onboarding de novos devs.

Nenhuma mudança de código é obrigatória: a arquitetura já está centralizada e funcional. Se quiser, podemos implementar a invalidação granular ou gerar o diagrama.