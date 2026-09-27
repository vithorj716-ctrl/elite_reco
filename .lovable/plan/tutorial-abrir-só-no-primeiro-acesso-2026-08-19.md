# Tutorial: abrir só no primeiro acesso

## O que acontece hoje

O convite de boas-vindas é exibido quando a preferência `apresentado` não existe no armazenamento local do navegador, sob uma chave única (`elite:tutorial:v1`) compartilhada por todos os usuários daquele dispositivo. Consequências:

- Em outro navegador, dispositivo ou aba anônima, o mesmo usuário vê o convite de novo (parece "toda vez que loga").
- Se dois usuários usam o mesmo dispositivo, o segundo nunca vê o tutorial obrigatório porque o primeiro já marcou a chave.
- Trocar de conta não reinicia nada.

## O que será feito

1. Memória por usuário e no servidor
   - Guardar o "já viu a apresentação" vinculado ao usuário, não ao navegador — assim o convite aparece uma única vez por conta, em qualquer dispositivo.
   - Manter o armazenamento local apenas como cache/otimista, evitando piscar o convite enquanto carrega.
2. Regra de exibição
   - O convite (tour obrigatório do perfil) abre uma única vez, no primeiro acesso da conta.
   - Depois disso, nada abre sozinho: os demais guias ficam disponíveis apenas pelo botão "Como usar" e pelo "Aprender esta tela".
   - Concluir ou pular marca como apresentado imediatamente.
3. Cobertura por perfil (já existe, será confirmada e revisada)
   - Locadora (cliente): guia do Portal — abas, nova solicitação, leitura de status, minhas motocicletas.
   - Agente: guia de Campo — capturas, execução, vistorias e financeiro pessoal.
   - Operador/Super Admin: guia completo da operação.
   - Ajustar os textos/passos desses dois guias onde estiverem desatualizados frente às telas atuais.

## Detalhes técnicos

- Nova coluna `tutorial_apresentado_em` (timestamptz) no perfil do usuário, com GRANT e política RLS permitindo que cada usuário leia/atualize a própria linha.
- `src/lib/tutorial/contexto.tsx`: ler a marca do perfil na hidratação; abrir boas-vindas só quando não houver marca; ao iniciar/pular/concluir, gravar no servidor e no cache local com chave por `usuario.id`.
- `src/lib/tutorial/passos.ts`: revisão dos guias `portal` e `campo` e dos alvos `data-tour` correspondentes.
