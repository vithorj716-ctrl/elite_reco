/**
 * Tradução única de falhas de comunicação com o banco, autenticação e arquivos.
 *
 * Antes cada serviço repassava a mensagem crua do servidor ("new row violates
 * row-level security policy", "Failed to fetch", "duplicate key value…"), o que
 * chegava ilegível na tela. Aqui a falha vira sempre uma frase clara, sem nunca
 * ser engolida em silêncio.
 */

export type ContextoErro =
  | "conexão"
  | "autenticação"
  | "permissão"
  | "envio"
  | "download"
  | "sincronização"
  | "banco";

export class ErroOperacao extends Error {
  readonly contexto: ContextoErro;
  readonly detalhe: string;

  constructor(mensagem: string, contexto: ContextoErro, detalhe = "") {
    super(mensagem);
    this.name = "ErroOperacao";
    this.contexto = contexto;
    this.detalhe = detalhe;
  }
}

interface FalhaBruta {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  statusCode?: string | number;
}

function semRede(msg: string) {
  return (
    /failed to fetch|networkerror|load failed|network request failed|ecconnreset|timeout/i.test(
      msg,
    ) || msg === ""
  );
}

/** Regras de negócio disparadas por gatilho no banco chegam prontas para o usuário. */
function regraDeNegocio(bruta: FalhaBruta) {
  return bruta.code === "P0001" || bruta.code === "P0002";
}

export function traduzirErro(bruta: unknown, area: ContextoErro = "banco"): ErroOperacao {
  if (bruta instanceof ErroOperacao) return bruta;

  const f = (bruta ?? {}) as FalhaBruta;
  const msg = String(f.message ?? bruta ?? "");
  const codigo = String(f.code ?? f.statusCode ?? "");
  const status = Number(f.status ?? f.statusCode ?? 0);

  if (semRede(msg)) {
    return new ErroOperacao(
      "Sem conexão com o servidor. Verifique a internet — nada foi salvo.",
      "conexão",
      msg,
    );
  }

  if (regraDeNegocio(f)) return new ErroOperacao(msg, area, codigo);

  if (status === 401 || codigo === "PGRST301" || /jwt|token|not authenticated/i.test(msg)) {
    return new ErroOperacao(
      "Sua sessão expirou. Entre novamente para continuar.",
      "autenticação",
      msg,
    );
  }

  if (status === 403 || codigo === "42501" || /row-level security|permission denied/i.test(msg)) {
    return new ErroOperacao(
      "Seu perfil não tem permissão para esta ação.",
      "permissão",
      msg,
    );
  }

  if (codigo === "23505") {
    return new ErroOperacao("Já existe um registro com estes dados.", "banco", msg);
  }
  if (codigo === "23503") {
    return new ErroOperacao(
      "Este registro está vinculado a outros e não pode ser removido.",
      "banco",
      msg,
    );
  }
  if (codigo === "23502") {
    return new ErroOperacao("Faltam campos obrigatórios para salvar.", "banco", msg);
  }

  if (area === "envio") {
    return new ErroOperacao(
      `Falha ao enviar o arquivo: ${msg || "tente novamente"}.`,
      "envio",
      msg,
    );
  }
  if (area === "download") {
    return new ErroOperacao(
      `Falha ao abrir o arquivo: ${msg || "tente novamente"}.`,
      "download",
      msg,
    );
  }
  if (area === "sincronização") {
    return new ErroOperacao(
      `Falha ao sincronizar os dados: ${msg || "tente novamente"}.`,
      "sincronização",
      msg,
    );
  }

  return new ErroOperacao(msg || "Falha inesperada ao falar com o banco.", area, codigo);
}

/** Interrompe a operação quando a resposta do banco trouxe erro. */
export function falhar(bruta: unknown, area: ContextoErro = "banco"): never {
  throw traduzirErro(bruta, area);
}

/** Uso: `conferir(error)` logo após uma chamada ao Supabase. */
export function conferirErro(
  bruta: unknown,
  area: ContextoErro = "banco",
): asserts bruta is null | undefined {
  if (bruta) falhar(bruta, area);
}

export function mensagemDoErro(e: unknown): string {
  return traduzirErro(e).message;
}
