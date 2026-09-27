/**
 * Contrato do importador inteligente: uma mensagem colada vira N itens
 * conferíveis antes de virar ordem.
 */
import type { Prioridade } from "@/domain/types";

export interface ItemImportado {
  locadoraTexto: string;
  locadoraId: string;
  locatario: string;
  telefone: string;
  telefoneSecundario: string;
  cpf: string;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  ano: string;
  host: string;
  pin: string;
  valorPendente: number;
  situacaoFinanceira: string;
  statusInformado: string;
  ultimoRastreio: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: string;
  longitude: string;
  linkMaps: string;
  linkRastreador: string;
  responsavel: string;
  prioridade: Prioridade;
  /** Serviço do catálogo escolhido na conferência. */
  servicoId: string;
  observacoes: string;
  resumo: string;
  /** Campos que a extração não conseguiu preencher — destacados na conferência. */
  faltantes: string[];
}

export const ITEM_VAZIO: ItemImportado = {
  locadoraTexto: "",
  locadoraId: "",
  locatario: "",
  telefone: "",
  telefoneSecundario: "",
  cpf: "",
  placa: "",
  marca: "",
  modelo: "",
  cor: "",
  ano: "",
  host: "",
  pin: "",
  valorPendente: 0,
  situacaoFinanceira: "",
  statusInformado: "",
  ultimoRastreio: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  latitude: "",
  longitude: "",
  linkMaps: "",
  linkRastreador: "",
  responsavel: "",
  prioridade: "normal",
  servicoId: "",
  observacoes: "",
  resumo: "",
  faltantes: [],
};

/** Campos exibidos na tela de conferência, na ordem operacional. */
export const CAMPOS_CONFERENCIA: { chave: keyof ItemImportado; rotulo: string }[] = [
  { chave: "placa", rotulo: "Placa" },
  { chave: "marca", rotulo: "Marca" },
  { chave: "modelo", rotulo: "Modelo" },
  { chave: "cor", rotulo: "Cor" },
  { chave: "ano", rotulo: "Ano" },
  { chave: "locatario", rotulo: "Locatário" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "telefoneSecundario", rotulo: "Telefone 2" },
  { chave: "host", rotulo: "Host" },
  { chave: "pin", rotulo: "PIN" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "uf", rotulo: "UF" },
  { chave: "cep", rotulo: "CEP" },
  { chave: "latitude", rotulo: "Latitude" },
  { chave: "longitude", rotulo: "Longitude" },
  { chave: "linkMaps", rotulo: "Google Maps" },
  { chave: "linkRastreador", rotulo: "Link do rastreador" },
  { chave: "ultimoRastreio", rotulo: "Último rastreio" },
  { chave: "situacaoFinanceira", rotulo: "Situação financeira" },
  { chave: "statusInformado", rotulo: "Status informado" },
  { chave: "responsavel", rotulo: "Responsável citado" },
];
