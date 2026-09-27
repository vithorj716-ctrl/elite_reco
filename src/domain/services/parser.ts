/**
 * Parser determinístico (regex) do importador inteligente.
 *
 * Extensível: para reconhecer um novo padrão basta acrescentar uma entrada em
 * `PADROES` — nenhuma outra parte do sistema precisa mudar. O resultado deste
 * parser é combinado com o da IA em `mesclar()`, sempre preferindo o valor mais
 * confiável (regex vence em campos estruturados como placa, CPF e CEP).
 */
import { ITEM_VAZIO, type ItemImportado } from "@/domain/types/importacao";
import type { Prioridade } from "@/domain/types";

type Campo = keyof ItemImportado;

interface Padrao {
  campo: Campo;
  expressoes: RegExp[];
  /** Normaliza o trecho capturado antes de gravar. */
  tratar?: (v: string) => string;
}

const so = (v: string) => v.replace(/\D/g, "");
const limpar = (v: string) =>
  v
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;]$/, "");

/** Rótulo seguido do valor até o fim da linha. */
function rotulo(...nomes: string[]) {
  return new RegExp(`(?:${nomes.join("|")})\\s*[:\\-–=]\\s*([^\\n\\r]+)`, "i");
}

export const PADROES: Padrao[] = [
  {
    campo: "placa",
    expressoes: [rotulo("placa"), /\b([A-Z]{3}\s?-?\s?\d[A-Z0-9]\d{2})\b/],
    tratar: (v) => limpar(v).toUpperCase().replace(/[\s-]/g, "").slice(0, 7),
  },
  { campo: "marca", expressoes: [rotulo("marca", "fabricante")], tratar: limpar },
  { campo: "modelo", expressoes: [rotulo("modelo", "moto", "veículo", "veiculo")], tratar: limpar },
  { campo: "cor", expressoes: [rotulo("cor")], tratar: limpar },
  { campo: "ano", expressoes: [rotulo("ano"), /\b(20[0-3]\d\/20[0-3]\d)\b/], tratar: limpar },
  {
    campo: "locatario",
    expressoes: [rotulo("locat[áa]rio", "cliente", "nome", "devedor", "condutor")],
    tratar: limpar,
  },
  { campo: "cpf", expressoes: [rotulo("cpf"), /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/], tratar: so },
  {
    campo: "telefone",
    expressoes: [
      rotulo("telefone", "fone", "contato", "whats(?:app)?", "tel"),
      /\((\d{2})\)\s?\d{4,5}-?\d{4}/,
    ],
    tratar: (v) => limpar(v),
  },
  {
    campo: "host",
    expressoes: [rotulo("host", "imei", "equipamento", "rastreador id")],
    tratar: (v) => limpar(v),
  },
  {
    campo: "pin",
    expressoes: [rotulo("pin", "senha do bloqueio", "c[óo]digo pin")],
    tratar: (v) => limpar(v),
  },
  { campo: "cep", expressoes: [rotulo("cep"), /\b(\d{5}-?\d{3})\b/], tratar: so },
  {
    campo: "endereco",
    expressoes: [rotulo("endere[çc]o", "rua", "logradouro", "local")],
    tratar: limpar,
  },
  { campo: "bairro", expressoes: [rotulo("bairro")], tratar: limpar },
  { campo: "cidade", expressoes: [rotulo("cidade", "munic[íi]pio")], tratar: limpar },
  {
    campo: "uf",
    expressoes: [rotulo("uf", "estado")],
    tratar: (v) => limpar(v).toUpperCase().slice(0, 2),
  },
  {
    campo: "ultimoRastreio",
    expressoes: [rotulo("[úu]ltimo rastreio", "[úu]ltima posi[çc][ãa]o", "rastreio")],
    tratar: limpar,
  },
  {
    campo: "situacaoFinanceira",
    expressoes: [
      rotulo("situa[çc][ãa]o financeira", "financeiro", "d[ée]bito", "inadimpl[êe]ncia"),
    ],
    tratar: limpar,
  },
  { campo: "statusInformado", expressoes: [rotulo("status", "situa[çc][ãa]o")], tratar: limpar },
  {
    campo: "responsavel",
    expressoes: [rotulo("respons[áa]vel", "solicitante", "atendente")],
    tratar: limpar,
  },
  {
    campo: "linkMaps",
    expressoes: [
      /(https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s]*)/i,
    ],
  },
  {
    campo: "linkRastreador",
    expressoes: [/(https?:\/\/(?!(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl))[^\s]+)/i],
  },
];

const COORDENADAS = /(-?\d{1,2}\.\d{4,})\s*[, ]\s*(-?\d{1,3}\.\d{4,})/;
const VALOR = /r\$\s*([\d.]+,\d{2}|\d+)/i;
const TELEFONES = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g;

const URGENCIA: { termos: RegExp; prioridade: Prioridade }[] = [
  { termos: /\burgente|urg[êe]ncia|imediato|hoje ainda\b/i, prioridade: "urgente" },
  { termos: /\bprioridade alta|prioritário|prioritaria|alta\b/i, prioridade: "alta" },
  { termos: /\bsem pressa|prioridade baixa\b/i, prioridade: "baixa" },
];

/** Extrai o que for possível de um bloco de texto usando apenas regex. */
export function extrair(texto: string): Partial<ItemImportado> {
  const achado: Partial<ItemImportado> = {};

  for (const padrao of PADROES) {
    for (const exp of padrao.expressoes) {
      const m = texto.match(exp);
      const bruto = m?.[1] ?? m?.[0];
      if (!bruto) continue;
      const valor = (padrao.tratar ?? limpar)(bruto);
      if (valor) {
        (achado as unknown as Record<string, unknown>)[padrao.campo] = valor;
        break;
      }
    }
  }

  const coord = texto.match(COORDENADAS);
  if (coord?.[1] && coord[2]) {
    achado.latitude = coord[1];
    achado.longitude = coord[2];
  }

  const valor = texto.match(VALOR);
  if (valor?.[1]) achado.valorPendente = Number(valor[1].replace(/\./g, "").replace(",", ".")) || 0;

  const fones = [...new Set(texto.match(TELEFONES) ?? [])].map(limpar);
  if (fones[0] && !achado.telefone) achado.telefone = fones[0];
  if (fones[1]) achado.telefoneSecundario = fones[1];

  for (const u of URGENCIA) {
    if (u.termos.test(texto)) {
      achado.prioridade = u.prioridade;
      break;
    }
  }

  return achado;
}

/**
 * Divide uma mensagem que contém várias motos em blocos independentes.
 * Usa a ocorrência de placas como âncora — cada placa inicia um novo bloco.
 */
export function dividirBlocos(texto: string): string[] {
  const placa = /\b[A-Z]{3}\s?-?\s?\d[A-Z0-9]\d{2}\b/g;
  const marcas: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = placa.exec(texto))) marcas.push(m.index);
  if (marcas.length <= 1) return [texto];

  const inicios = marcas.map((i) => {
    const quebra = texto.lastIndexOf("\n", i);
    return quebra === -1 ? 0 : quebra + 1;
  });
  const unicos = [...new Set(inicios)];
  return unicos
    .map((ini, k) => texto.slice(ini, unicos[k + 1] ?? texto.length).trim())
    .filter(Boolean);
}

/** Combina IA + regex. O regex prevalece nos campos estruturados. */
const ESTRUTURADOS: Campo[] = [
  "placa",
  "cpf",
  "cep",
  "latitude",
  "longitude",
  "linkMaps",
  "linkRastreador",
  "host",
  "pin",
];

export function mesclar(ia: Partial<ItemImportado>, regex: Partial<ItemImportado>): ItemImportado {
  const item: ItemImportado = { ...ITEM_VAZIO, ...ia };
  for (const [chave, valor] of Object.entries(regex)) {
    const c = chave as Campo;
    if (valor === "" || valor === undefined || valor === null) continue;
    const atual = item[c];
    if (ESTRUTURADOS.includes(c) || atual === "" || atual === 0 || atual === undefined) {
      (item as unknown as Record<string, unknown>)[c] = valor;
    }
  }
  item.faltantes = calcularFaltantes(item);
  return item;
}

const OBRIGATORIOS: Campo[] = ["placa", "modelo", "locatario", "telefone", "endereco", "cidade"];

export function calcularFaltantes(item: ItemImportado): string[] {
  return OBRIGATORIOS.filter((c) => !String(item[c] ?? "").trim());
}

/** Resumo operacional local — usado quando a IA não responde. */
export function resumoLocal(item: ItemImportado, texto: string): string {
  const pontos: string[] = [];
  if (/bloquead/i.test(texto)) pontos.push("Moto bloqueada");
  if (/inadimpl|atraso|em aberto/i.test(texto)) pontos.push("Cliente inadimplente");
  if (/n[ãa]o atende|sem contato|desliga/i.test(texto)) pontos.push("Não atende telefone");
  if (item.host) pontos.push("Possui Host");
  if (item.pin) pontos.push("Possui PIN");
  if (item.ultimoRastreio) pontos.push(`Último rastreio: ${item.ultimoRastreio}`);
  if (item.prioridade === "alta" || item.prioridade === "urgente")
    pontos.push(`Prioridade ${item.prioridade}`);
  return pontos.map((p) => `• ${p}`).join("\n");
}
