/**
 * Consulta de dados públicos (CNPJ e CEP) na BrasilAPI.
 * Evita digitação manual de tudo que pode ser obtido automaticamente.
 */

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnae: string;
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  telefone: string;
  email: string;
}

export interface DadosCep {
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  rua: string;
}

export const soDigitos = (v: string) => v.replace(/\D/g, "");

export function formatarCnpj(v: string) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatarCep(v: string) {
  const d = soDigitos(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function formatarCpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatarTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

interface RespostaCnpj {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  situacao_cadastral?: number;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  bairro?: string;
  logradouro?: string;
  descricao_tipo_de_logradouro?: string;
  numero?: string;
  complemento?: string;
  ddd_telefone_1?: string;
  email?: string;
}

const capitalizar = (t: string) =>
  t
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p) => (p.length > 2 ? p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1) : p))
    .join(" ");

/** Busca os dados públicos de um CNPJ. Lança erro legível quando não existe. */
export async function consultarCnpj(cnpj: string): Promise<DadosCnpj> {
  const limpo = soDigitos(cnpj);
  if (limpo.length !== 14) throw new Error("Informe os 14 dígitos do CNPJ.");

  let resposta: Response;
  try {
    resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
  } catch {
    throw new Error("Não foi possível consultar o CNPJ agora. Verifique a conexão.");
  }
  if (resposta.status === 404) throw new Error("CNPJ não encontrado na Receita Federal.");
  if (!resposta.ok) throw new Error("Falha ao consultar o CNPJ. Tente novamente.");

  const d = (await resposta.json()) as RespostaCnpj;
  const logradouro = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim();

  return {
    cnpj: formatarCnpj(limpo),
    razaoSocial: capitalizar(d.razao_social ?? ""),
    nomeFantasia: capitalizar(d.nome_fantasia ?? ""),
    situacaoCadastral: capitalizar(d.descricao_situacao_cadastral ?? ""),
    dataAbertura: d.data_inicio_atividade ?? "",
    naturezaJuridica: capitalizar(d.natureza_juridica ?? ""),
    cnae: [d.cnae_fiscal, d.cnae_fiscal_descricao].filter(Boolean).join(" — "),
    cep: formatarCep(d.cep ?? ""),
    uf: (d.uf ?? "").toUpperCase(),
    cidade: capitalizar(d.municipio ?? ""),
    bairro: capitalizar(d.bairro ?? ""),
    rua: capitalizar(logradouro),
    numero: d.numero ?? "",
    complemento: capitalizar(d.complemento ?? ""),
    telefone: d.ddd_telefone_1 ? formatarTelefone(d.ddd_telefone_1) : "",
    email: (d.email ?? "").toLowerCase(),
  };
}

/** Busca endereço a partir do CEP. */
export async function consultarCep(cep: string): Promise<DadosCep> {
  const limpo = soDigitos(cep);
  if (limpo.length !== 8) throw new Error("Informe os 8 dígitos do CEP.");
  const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`);
  if (!resposta.ok) throw new Error("CEP não encontrado.");
  const d = (await resposta.json()) as {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
  };
  return {
    cep: formatarCep(d.cep),
    uf: d.state ?? "",
    cidade: d.city ?? "",
    bairro: d.neighborhood ?? "",
    rua: d.street ?? "",
  };
}
