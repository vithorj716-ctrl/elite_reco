/**
 * Importador inteligente — orquestra IA + parser, reconhece a locadora,
 * detecta duplicidade e transforma os itens conferidos em ordens.
 * Usado igualmente por administradores, operadores e locadoras.
 */
import { interpretarMensagem } from "@/lib/importador.functions";
import {
  calcularFaltantes,
  dividirBlocos,
  extrair,
  mesclar,
  resumoLocal,
} from "@/domain/services/parser";
import { ITEM_VAZIO, type ItemImportado } from "@/domain/types/importacao";
import type { ApelidoLocadora, Locadora, Ordem, Prioridade } from "@/domain/types";
import { OrdensService, type NovaOrdem } from "@/services/ordens.service";

const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];

function normalizar(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reconhece a locadora citada no texto mesmo com escrita livre
 * ("moto da liberta", "UIRAPURU LOCADORA", "libertá"). Usa nome, nome fantasia,
 * razão social e os apelidos cadastrados.
 */
export function detectarLocadora(
  texto: string,
  locadoras: Locadora[],
  apelidos: ApelidoLocadora[] = [],
): string {
  const alvo = normalizar(texto);
  const candidatos: { id: string; termo: string }[] = [];

  for (const l of locadoras) {
    for (const bruto of [l.nome, l.nomeFantasia, l.razaoSocial]) {
      const termo = normalizar(bruto ?? "");
      if (termo.length >= 3) candidatos.push({ id: l.id, termo });
    }
    const cnpj = (l.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length === 14 && texto.replace(/\D/g, "").includes(cnpj)) return l.id;
  }
  for (const a of apelidos) {
    const termo = normalizar(a.apelido);
    if (termo.length >= 3) candidatos.push({ id: a.locadoraId, termo });
  }

  // termo mais longo encontrado vence — evita casar "moto" com "Motoclub"
  const achados = candidatos
    .filter(
      (c) =>
        alvo.includes(c.termo) || c.termo.split(" ").some((p) => p.length >= 4 && alvo.includes(p)),
    )
    .sort((a, b) => b.termo.length - a.termo.length);

  return achados[0]?.id ?? "";
}

/** Aceita 1234.5, "R$ 2.340,00" ou "2340" e devolve sempre um número. */
function comoNumero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const bruto = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!bruto) return 0;
  const normalizado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Interpreta uma mensagem colada e devolve os itens prontos para conferência. */
export async function interpretar(
  texto: string,
  locadoras: Locadora[],
  apelidos: ApelidoLocadora[],
  locadoraPadrao = "",
): Promise<{ itens: ItemImportado[]; aviso?: string }> {
  const resposta = await interpretarMensagem({ data: { texto } }).catch(() => ({
    itens: [],
    erro: "IA indisponível — extração feita apenas por padrões.",
  }));

  const blocos = dividirBlocos(texto);
  const brutos = resposta.itens.length > 0 ? resposta.itens : blocos.map(() => ({}));

  const itens = brutos.map((bruto, i) => {
    const parcial: Partial<ItemImportado> = {};
    for (const [chave, valor] of Object.entries(bruto)) {
      if (chave === "valorPendente") parcial.valorPendente = comoNumero(valor);
      else if (chave === "prioridade") {
        const p = comoTexto(valor).toLowerCase() as Prioridade;
        if (PRIORIDADES.includes(p)) parcial.prioridade = p;
      } else if (chave in ITEM_VAZIO) {
        (parcial as unknown as Record<string, unknown>)[chave] = comoTexto(valor);
      }
    }

    // casa o bloco de texto correspondente pela placa, quando houver
    const placa = comoTexto(parcial.placa)
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    const bloco =
      (placa &&
        blocos.find((b) =>
          b
            .replace(/[^A-Z0-9]/gi, "")
            .toUpperCase()
            .includes(placa),
        )) ||
      blocos[i] ||
      texto;

    const item = mesclar(parcial, extrair(bloco));
    item.locadoraId =
      detectarLocadora(`${item.locadoraTexto} ${bloco}`, locadoras, apelidos) ||
      detectarLocadora(texto, locadoras, apelidos) ||
      locadoraPadrao;
    if (!item.resumo) item.resumo = resumoLocal(item, bloco);
    item.observacoes = item.observacoes || "";
    item.faltantes = calcularFaltantes(item);
    return item;
  });

  return resposta.erro ? { itens, aviso: resposta.erro } : { itens };
}

export interface Duplicidade {
  campo: string;
  ordem: Ordem;
}

const ABERTAS = ["pendente_definicao", "liberada", "distribuida", "em_andamento"];

/** Procura ocorrência aberta com a mesma placa, host, PIN, telefone ou CPF. */
export function encontrarDuplicidade(item: ItemImportado, ordens: Ordem[]): Duplicidade | null {
  const chaves: { campo: string; valor: string; ler: (o: Ordem) => string }[] = [
    { campo: "Placa", valor: item.placa, ler: (o) => o.placa },
    { campo: "Host", valor: item.host, ler: (o) => o.host },
    { campo: "PIN", valor: item.pin, ler: (o) => o.pin },
    { campo: "Telefone", valor: item.telefone, ler: (o) => o.telefone },
    { campo: "CPF", valor: item.cpf, ler: (o) => o.cpf },
  ];
  const limpo = (v: string) => v.replace(/[^a-z0-9]/gi, "").toUpperCase();

  for (const chave of chaves) {
    if (!chave.valor || limpo(chave.valor).length < 4) continue;
    const achada = ordens.find(
      (o) => ABERTAS.includes(o.status) && limpo(chave.ler(o)) === limpo(chave.valor),
    );
    if (achada) return { campo: chave.campo, ordem: achada };
  }
  return null;
}

/**
 * Conflito de cadastro da MESMA placa: a operação nova é sempre permitida —
 * uma moto pode ser recolhida várias vezes —, mas a central é avisada quando
 * marca, modelo ou cor divergem do histórico. Nada do histórico é alterado.
 */
export interface ConflitoPlaca {
  campo: string;
  anterior: string;
  novo: string;
}

export interface HistoricoPlaca {
  ordem: Ordem;
  total: number;
  diferencas: ConflitoPlaca[];
}

export function conferirHistoricoDaPlaca(
  item: ItemImportado,
  ordens: Ordem[],
): HistoricoPlaca | null {
  const placa = (item.placa || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (placa.length < 6) return null;

  const anteriores = ordens
    .filter((o) => o.placa.replace(/[^a-z0-9]/gi, "").toUpperCase() === placa)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const ultima = anteriores[0];
  if (!ultima) return null;

  const comparar = (campo: string, anterior: string, novo: string): ConflitoPlaca | null => {
    const a = anterior.trim().toLowerCase();
    const b = novo.trim().toLowerCase();
    if (!a || !b || a === "—" || b === "—" || a === b) return null;
    return { campo, anterior, novo };
  };

  const diferencas = [
    comparar("Marca", ultima.marca, item.marca),
    comparar("Modelo", ultima.modelo, item.modelo),
    comparar("Cor", ultima.cor, item.cor),
  ].filter((d): d is ConflitoPlaca => d !== null);

  return { ordem: ultima, total: anteriores.length, diferencas };
}

function paraNovaOrdem(item: ItemImportado, textoOrigem: string): NovaOrdem {
  return {
    locadoraId: item.locadoraId,
    placa: item.placa || "SEM PLACA",
    marca: item.marca || "—",
    modelo: item.modelo || "—",
    ano: item.ano || "—",
    cor: item.cor || "—",
    valorPendente: item.valorPendente || 0,
    telefone: item.telefone || "—",
    endereco: item.endereco || "—",
    cidade: item.cidade || "—",
    observacoes: item.observacoes || undefined,
    linkRastreador: item.linkRastreador || undefined,
    prioridade: item.prioridade,
    servicoId: item.servicoId,
    locatario: item.locatario,
    cpf: item.cpf,
    telefoneSecundario: item.telefoneSecundario,
    host: item.host,
    pin: item.pin,
    bairro: item.bairro,
    uf: item.uf,
    cep: item.cep,
    latitude: item.latitude,
    longitude: item.longitude,
    linkMaps: item.linkMaps,
    ultimoRastreio: item.ultimoRastreio,
    situacaoFinanceira: item.situacaoFinanceira,
    statusInformado: item.statusInformado,
    resumoIa: item.resumo,
    textoOrigem,
  };
}

/** Cria uma ordem por item conferido e registra o histórico imutável. */
export async function criarSolicitacoes(
  itens: ItemImportado[],
  contexto: { autor: string; textoOrigem: string },
): Promise<Ordem[]> {
  const novas = itens.map((item) => paraNovaOrdem(item, contexto.textoOrigem));
  const criadas = await OrdensService.criarLote(novas);
  await Promise.all(
    criadas.map((o) =>
      OrdensService.registrarHistorico(
        o.id,
        contexto.autor,
        "Solicitação criada pelo importador inteligente",
        o.resumoIa || undefined,
      ),
    ),
  );
  return criadas;
}
