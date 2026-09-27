import type { Papel } from "@/domain/types";
import type { PassoTutorial, Tutorial } from "./tipos";

/**
 * Conteúdo do instrutor virtual. Todos os passos apontam para telas e
 * elementos que existem de fato no sistema — nada aqui é hipotético.
 * Os alvos usam `data-tour`, aplicados nos componentes base (Página, filtros,
 * tabelas) e no menu lateral, o que mantém o tour imune a mudanças de layout.
 */

const menu = (rota: string) => `[data-tour="menu-${rota}"]`;

const boasVindas: PassoTutorial = {
  id: "boas-vindas",
  titulo: "Bem-vindo à Elite",
  texto:
    "Vamos percorrer o sistema na ordem real da operação: da fila de recolhimentos até a liquidação financeira. Use PRÓXIMO para avançar, VOLTAR para rever e SAIR quando quiser — o progresso fica salvo.",
  centralizado: true,
};

const encerramento: PassoTutorial = {
  id: "fim",
  titulo: "Pronto para operar",
  texto:
    "Você já conhece o caminho completo. Sempre que precisar, use COMO USAR no topo para rever o guia inteiro ou apenas o módulo em que estiver.",
  centralizado: true,
};

const passosDashboard: PassoTutorial[] = [
  {
    id: "menu-dashboard",
    titulo: "Painel",
    texto:
      "O Painel é o resumo do dia: volume de ordens, situação dos agentes e indicadores financeiros. É a primeira tela de quem administra a operação.",
    rota: "/dashboard",
    alvo: menu("/dashboard"),
  },
  {
    id: "dashboard-indicadores",
    titulo: "Indicadores",
    texto:
      "Os números do topo mostram o estado atual da operação. Eles se atualizam sozinhos conforme a equipe de campo avança nas ordens.",
    rota: "/dashboard",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "menu-operacao",
    titulo: "Operação do dia",
    texto:
      "Aqui fica o acompanhamento em tempo real: o que está pendente, em andamento e concluído hoje. É a tela de comando do operador.",
    rota: "/operacao",
    alvo: menu("/operacao"),
  },
];

const passosSolicitacoes: PassoTutorial[] = [
  {
    id: "menu-ordens",
    titulo: "Fila de recolhimentos",
    texto:
      "Toda solicitação de recolhimento vive nesta fila. No próximo passo vamos abrir a tela e conhecer as ações disponíveis.",
    rota: "/ordens",
    alvo: menu("/ordens"),
  },
  {
    id: "ordens-acoes",
    titulo: "Ações da tela",
    texto:
      "No canto superior ficam as ações principais da fila, como criar e distribuir ordens para os agentes. É por aqui que a operação começa.",
    rota: "/ordens",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "ordens-filtros",
    titulo: "Filtros e busca",
    texto:
      "Use a barra de filtros para localizar por placa, locadora, status ou período. Os filtros são cumulativos e refletem imediatamente na lista.",
    rota: "/ordens",
    alvo: '[data-tour="filtros"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "ordens-tabela",
    titulo: "A fila",
    texto:
      "Cada linha é uma ordem: placa, locadora, agente responsável e status. Clique em uma linha para abrir a ficha completa da ordem.",
    rota: "/ordens",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
    acao: "Você pode abrir uma ordem agora — o tutorial continua depois.",
  },
  {
    id: "importador",
    titulo: "Importador inteligente",
    texto:
      "Quando a locadora envia uma planilha ou lista, o Importador lê os dados e gera as ordens automaticamente, sem digitação manual.",
    rota: "/importador",
    alvo: menu("/importador"),
  },
];

const passosEvidencias: PassoTutorial[] = [
  {
    id: "evid-ordem",
    titulo: "Ficha da operação",
    texto:
      "Dentro de cada ordem ou vistoria fica a ficha completa: dados da moto, locatário, contato, rastreador, evidências, checklist e financeiro.",
    rota: "/ordens",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "evid-fotos",
    titulo: "Fotografias obrigatórias",
    texto:
      "O agente envia as fotos pelo app de campo. Cada foto recebe marca d'água automática com data, hora, KM e identificação do agente — por isso as imagens não podem ser adulteradas.",
    rota: "/vistorias",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "evid-visualizador",
    titulo: "Visualizar e conferir",
    texto:
      "As miniaturas abrem em tela cheia com zoom e botão de fechar. Enquanto a operação não estiver concluída, uma foto pode ser substituída; depois disso o histórico é imutável.",
    rota: "/vistorias",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "evid-checklist",
    titulo: "Checklist da motocicleta",
    texto:
      "O checklist avalia item a item (bom, regular ou ruim). Qualquer avaria exige foto — sem isso o sistema não deixa concluir.",
    rota: "/vistorias/checklist",
    alvo: menu("/vistorias/checklist"),
  },
];

const passosAgentes: PassoTutorial[] = [
  {
    id: "menu-agentes",
    titulo: "Agentes",
    texto:
      "Aqui você cadastra e acompanha a equipe de campo: dados, foto de perfil, situação e histórico de execuções.",
    rota: "/agentes",
    alvo: menu("/agentes"),
  },
  {
    id: "agentes-novo",
    titulo: "Cadastrar agente",
    texto:
      "Use a ação no topo para cadastrar um novo agente. Depois de cadastrado, ele passa a aparecer na distribuição de ordens e vistorias.",
    rota: "/agentes",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "agentes-atribuir",
    titulo: "Atribuir e acompanhar",
    texto:
      "A atribuição acontece na fila: selecione as ordens e distribua. O sistema aceita agente principal e agente auxiliar, e a remuneração de cada um segue a tabela cadastrada.",
    rota: "/ordens",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "agentes-ficha",
    titulo: "Ficha do agente",
    texto:
      "Abrir um agente mostra tudo o que ele executou e quanto tem a receber. É a mesma base usada pelo financeiro — não existe cadastro paralelo.",
    rota: "/agentes",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
  },
];

const passosVistorias: PassoTutorial[] = [
  {
    id: "menu-vistorias",
    titulo: "Fila de vistorias",
    texto:
      "As vistorias seguem o mesmo padrão dos recolhimentos: solicitação, distribuição, execução em campo e conclusão com evidências.",
    rota: "/vistorias",
    alvo: menu("/vistorias"),
  },
  {
    id: "vistorias-nova",
    titulo: "Nova vistoria",
    texto:
      "A ação no topo cria a solicitação: locadora, motocicleta e observações. Se a moto tiver rastreador cadastrado, host e PIN são herdados automaticamente.",
    rota: "/vistorias",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "vistorias-motos",
    titulo: "Motos e prazos",
    texto:
      "Aqui ficam as motocicletas cadastradas, com placa, dados do rastreador e o semáforo do ciclo de vistoria — verde, amarelo e vermelho conforme o prazo.",
    rota: "/vistorias/motos",
    alvo: menu("/vistorias/motos"),
  },
];

const passosFinanceiro: PassoTutorial[] = [
  {
    id: "menu-financeiro",
    titulo: "Financeiro",
    texto:
      "O financeiro é único: recolhimentos e vistorias aparecem juntos, discriminados por tipo. Nada fica fora do caixa.",
    rota: "/financeiro",
    alvo: menu("/financeiro"),
  },
  {
    id: "fin-abas",
    titulo: "Contas a receber e a pagar",
    texto:
      "As abas separam o que a locadora deve (a receber) do que a Elite deve ao agente (a pagar), além de lançamentos e auditoria.",
    rota: "/financeiro",
    alvo: '[role="tablist"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "fin-valores",
    titulo: "Como o valor é formado",
    texto:
      "Valor do serviço vem da tabela da locadora. Adicionais e taxas entram como lançamentos. Adiantamento é o valor já pago ao agente e reduz o saldo pendente.",
    rota: "/financeiro",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "fin-tabelas",
    titulo: "Tabelas de cobrança e remuneração",
    texto:
      "Na aba de tabelas você define quanto cada locadora paga e quanto cada agente recebe, por serviço e por faixa de KM. Toda operação nova usa essas tabelas.",
    rota: "/financeiro",
    alvo: '[role="tablist"]',
    alternativos: ['[data-tour="pagina"]'],
  },
];

const passosLiquidacao: PassoTutorial[] = [
  {
    id: "liq-lista",
    titulo: "Conferir antes de liquidar",
    texto:
      "Na lista de contas, confira valor, tipo da operação e lançamentos vinculados. Cada linha mostra a origem do dinheiro.",
    rota: "/financeiro",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "liq-botao",
    titulo: "Liquidar",
    texto:
      "Selecione os registros e use LIQUIDAR. A baixa é gravada registro a registro, na tabela certa: se um item falhar, os demais são liquidados mesmo assim e o motivo aparece no aviso.",
    rota: "/financeiro",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "liq-depois",
    titulo: "Depois da liquidação",
    texto:
      "O item sai de pendente e passa a liquidado, com data e responsável. O valor deixa de contar no saldo em aberto e fica registrado na auditoria.",
    rota: "/financeiro",
    alvo: '[data-tour="pagina"]',
  },
];

const passosHistorico: PassoTutorial[] = [
  {
    id: "hist-importacoes",
    titulo: "Importações",
    texto:
      "Cada lote importado fica registrado com data, origem e ordens geradas — útil para conferir o que a locadora enviou.",
    rota: "/importacoes",
    alvo: menu("/importacoes"),
  },
  {
    id: "hist-busca",
    titulo: "Pesquisar operações antigas",
    texto:
      "Na fila, os filtros também alcançam operações concluídas e canceladas. É assim que você recupera uma operação antiga.",
    rota: "/ordens",
    alvo: '[data-tour="filtros"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "hist-linha-tempo",
    titulo: "Linha do tempo da operação",
    texto:
      "Dentro de cada ficha existe o histórico imutável: quem fez, quando e o que mudou, junto das evidências enviadas no campo.",
    rota: "/ordens",
    alvo: '[data-tour="tabela"]',
    alternativos: ['[data-tour="pagina"]'],
  },
];

const passosRelatorios: PassoTutorial[] = [
  {
    id: "menu-relatorios",
    titulo: "Relatórios",
    texto:
      "Os relatórios consolidam produção e valores por período, locadora e agente.",
    rota: "/relatorios",
    alvo: menu("/relatorios"),
  },
  {
    id: "rel-filtros",
    titulo: "Período e filtros",
    texto:
      "Escolha o intervalo e os filtros desejados; os números e gráficos recalculam na hora.",
    rota: "/relatorios",
    alvo: '[data-tour="filtros"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "rel-exportar",
    titulo: "Visualizar e exportar",
    texto:
      "As ações no topo permitem imprimir ou exportar o resultado para enviar à locadora.",
    rota: "/relatorios",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
];

const passosConfiguracoes: PassoTutorial[] = [
  {
    id: "cfg-locadoras",
    titulo: "Locadoras",
    texto:
      "Cadastro das locadoras atendidas, com contato, condições comerciais e acesso ao portal do cliente.",
    rota: "/locadoras",
    alvo: menu("/locadoras"),
  },
  {
    id: "cfg-usuarios",
    titulo: "Usuários e acessos",
    texto:
      "Aqui você cria usuários, define o papel de cada um e, quando alguém esquece a senha, gera uma nova diretamente na ficha.",
    rota: "/usuarios",
    alvo: menu("/usuarios"),
  },
  {
    id: "cfg-checklist",
    titulo: "Itens do checklist",
    texto:
      "Os itens avaliados na vistoria são configuráveis. Itens obrigatórios passam a ser exigidos automaticamente nas próximas vistorias.",
    rota: "/vistorias/checklist",
    alvo: menu("/vistorias/checklist"),
  },
];

const passosPortal: PassoTutorial[] = [
  {
    id: "portal-abas",
    titulo: "Seu portal",
    texto:
      "No portal você acompanha solicitações, suas motocicletas e o financeiro — tudo em tempo real, sem precisar ligar para a central.",
    rota: "/portal",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "portal-nova",
    titulo: "Nova solicitação",
    texto:
      "Use a ação no topo para solicitar um recolhimento. Informe a motocicleta e os dados disponíveis; a central assume a partir daí.",
    rota: "/portal",
    alvo: '[data-tour="acoes-pagina"]',
    alternativos: ['[data-tour="pagina"]'],
  },
  {
    id: "portal-status",
    titulo: "Acompanhamento",
    texto:
      "Cada solicitação mostra o status real: recebida, distribuída, em campo e concluída, com as evidências fotográficas anexadas.",
    rota: "/portal",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "portal-motos",
    titulo: "Motocicletas e vistorias",
    texto:
      "Na ficha de cada moto ficam as vistorias e os recolhimentos separados, com galeria de fotos e linha do tempo.",
    rota: "/vistorias/motos",
    alvo: menu("/vistorias/motos"),
  },
];

const passosAgenteCampo: PassoTutorial[] = [
  {
    id: "campo-capturas",
    titulo: "Minhas capturas",
    texto:
      "Esta é a sua fila. Aceite o serviço, informe deslocamento e chegada — cada etapa fica registrada com horário.",
    rota: "/agente",
    alvo: menu("/agente"),
  },
  {
    id: "campo-execucao",
    titulo: "Execução travada por etapa",
    texto:
      "O app libera uma etapa por vez: KM, fotos obrigatórias, checklist e termo. Só depois disso o botão de concluir aparece.",
    rota: "/agente",
    alvo: '[data-tour="pagina"]',
  },
  {
    id: "campo-vistorias",
    titulo: "Minhas vistorias",
    texto:
      "As vistorias atribuídas a você ficam nesta tela, com o mesmo fluxo guiado das capturas.",
    rota: "/agente/vistorias",
    alvo: menu("/agente/vistorias"),
  },
  {
    id: "campo-financeiro",
    titulo: "Meu financeiro",
    texto:
      "Aqui você vê o que já executou, os adiantamentos recebidos e o saldo a receber, serviço por serviço.",
    rota: "/agente/financeiro",
    alvo: menu("/agente/financeiro"),
  },
];

const TODOS: Papel[] = ["super_admin", "operador", "cliente", "agente"];
const CENTRAL: Papel[] = ["super_admin", "operador"];

export const TUTORIAIS: Tutorial[] = [
  {
    id: "completo",
    titulo: "Guia completo",
    resumo: "O caminho inteiro: do painel à liquidação e aos relatórios.",
    papeis: CENTRAL,
    passos: [
      boasVindas,
      ...passosDashboard,
      ...passosSolicitacoes,
      ...passosVistorias,
      ...passosEvidencias,
      ...passosAgentes,
      ...passosFinanceiro,
      ...passosLiquidacao,
      ...passosHistorico,
      ...passosRelatorios,
      ...passosConfiguracoes,
      encerramento,
    ],
  },
  {
    id: "dashboard",
    titulo: "Painel e operação do dia",
    resumo: "Leitura rápida dos indicadores e do andamento em tempo real.",
    papeis: CENTRAL,
    passos: passosDashboard,
  },
  {
    id: "solicitacoes",
    titulo: "Solicitações e recolhimentos",
    resumo: "Criar, filtrar, distribuir e acompanhar a fila.",
    papeis: CENTRAL,
    passos: passosSolicitacoes,
  },
  {
    id: "vistorias",
    titulo: "Vistorias e motocicletas",
    resumo: "Solicitação, prazos, rastreador e execução em campo.",
    papeis: CENTRAL,
    passos: passosVistorias,
  },
  {
    id: "evidencias",
    titulo: "Evidências e checklist",
    resumo: "Fotos obrigatórias, marca d'água, KM e avarias.",
    papeis: CENTRAL,
    passos: passosEvidencias,
  },
  {
    id: "agentes",
    titulo: "Agentes",
    resumo: "Cadastro, atribuição, agente auxiliar e histórico.",
    papeis: CENTRAL,
    passos: passosAgentes,
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    resumo: "Valores, adiantamentos, tabelas e pendências.",
    papeis: ["super_admin"],
    passos: passosFinanceiro,
  },
  {
    id: "liquidacao",
    titulo: "Liquidação",
    resumo: "Conferência, baixa dos valores e o que muda depois.",
    papeis: ["super_admin"],
    passos: passosLiquidacao,
  },
  {
    id: "historico",
    titulo: "Histórico",
    resumo: "Importações, busca de operações antigas e linha do tempo.",
    papeis: CENTRAL,
    passos: passosHistorico,
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    resumo: "Período, filtros e exportação.",
    papeis: CENTRAL,
    passos: passosRelatorios,
  },
  {
    id: "configuracoes",
    titulo: "Cadastros e configurações",
    resumo: "Locadoras, usuários, acessos e itens do checklist.",
    papeis: ["super_admin"],
    passos: passosConfiguracoes,
  },
  {
    id: "portal",
    titulo: "Portal da locadora",
    resumo: "Solicitar recolhimento e acompanhar suas motocicletas.",
    papeis: ["cliente"],
    passos: [boasVindas, ...passosPortal, encerramento],
  },
  {
    id: "campo",
    titulo: "App do agente",
    resumo: "Fila, execução travada por etapa e financeiro pessoal.",
    papeis: ["agente"],
    passos: [boasVindas, ...passosAgenteCampo, encerramento],
  },
];

export function tutoriaisDoPapel(papel: Papel | undefined) {
  if (!papel) return [];
  return TUTORIAIS.filter((t) => t.papeis.includes(papel));
}

export function tutorialPorId(id: string) {
  return TUTORIAIS.find((t) => t.id === id);
}

/** Guia sugerido como "aprender esta tela" para a rota atual. */
export function tutorialDaRota(pathname: string, papel: Papel | undefined): Tutorial | undefined {
  const mapa: Array<[string, string]> = [
    ["/agente/financeiro", "campo"],
    ["/agente/vistorias", "campo"],
    ["/agente", "campo"],
    ["/portal", "portal"],
    ["/dashboard", "dashboard"],
    ["/operacao", "dashboard"],
    ["/ordens", "solicitacoes"],
    ["/importador", "solicitacoes"],
    ["/importacoes", "historico"],
    ["/vistorias/checklist", "evidencias"],
    ["/vistorias/motos", "vistorias"],
    ["/vistorias", "vistorias"],
    ["/agentes", "agentes"],
    ["/financeiro", "financeiro"],
    ["/relatorios", "relatorios"],
    ["/locadoras", "configuracoes"],
    ["/usuarios", "configuracoes"],
  ];
  const achado = mapa.find(([rota]) => pathname === rota || pathname.startsWith(rota + "/"));
  if (!achado) return undefined;
  const tutorial = tutorialPorId(achado[1]);
  if (!tutorial || !papel || !tutorial.papeis.includes(papel)) return undefined;
  return tutorial;
}

/** Guia inicial oferecido no primeiro acesso, conforme o papel. */
export function tutorialInicial(papel: Papel | undefined) {
  if (!papel) return undefined;
  if (papel === "cliente") return tutorialPorId("portal");
  if (papel === "agente") return tutorialPorId("campo");
  return tutorialPorId("completo");
}
