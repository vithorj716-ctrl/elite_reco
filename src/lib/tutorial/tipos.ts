import type { Papel } from "@/domain/types";

/** Um passo do instrutor virtual. */
export interface PassoTutorial {
  /** Identificador estável do passo (usado em progresso salvo). */
  id: string;
  titulo: string;
  texto: string;
  /** Seletor CSS do alvo — normalmente `[data-tour="..."]`. */
  alvo?: string;
  /** Alvos alternativos, na ordem, quando o principal não existir na tela. */
  alternativos?: string[];
  /** Rota que precisa estar aberta antes de destacar o alvo. */
  rota?: string;
  /** Passo sem alvo: exibido centralizado (abertura, encerramento, conceitos). */
  centralizado?: boolean;
  /** Dica de ação real esperada do usuário ("clique aqui para continuar"). */
  acao?: string;
}

export interface Tutorial {
  id: string;
  titulo: string;
  resumo: string;
  papeis: Papel[];
  passos: PassoTutorial[];
}

export type ModoTutorial = "interativo" | "demonstracao";
