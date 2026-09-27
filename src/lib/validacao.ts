/**
 * Feedback padrão de campos obrigatórios.
 *
 * Um único dialeto em todo o sistema: o operador vê exatamente quais campos
 * faltam (lista nomeada no aviso) e é levado até o primeiro campo destacado.
 */
import { toast } from "sonner";

export type Erros = Record<string, string>;

/** Marca usada pelos campos do kit de formulário quando estão inválidos. */
export const ATRIBUTO_INVALIDO = "data-campo-invalido";

/**
 * Mostra o aviso com a lista de pendências e ilumina o primeiro campo faltando.
 * Retorna `false` quando existe erro — permite `if (!avisarErros(e)) return;`.
 */
export function avisarErros(erros: Erros, titulo = "Faltam dados obrigatórios"): boolean {
  const itens = Object.values(erros).filter(Boolean);
  if (itens.length === 0) return true;

  toast.error(titulo, {
    description: itens.map((t) => `• ${t}`).join("\n"),
    duration: 6000,
  });

  requestAnimationFrame(() => focarPrimeiroInvalido());
  return false;
}

/** Rola até o primeiro campo inválido e coloca o cursor nele. */
export function focarPrimeiroInvalido() {
  const alvo = document.querySelector<HTMLElement>(`[${ATRIBUTO_INVALIDO}="1"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ behavior: "smooth", block: "center" });
  const foco = alvo.querySelector<HTMLElement>("input, select, textarea, button");
  foco?.focus({ preventScroll: true });
}

/** Remove uma chave do mapa de erros — usado no onChange de cada campo. */
export function limparErro(campo: string) {
  return (atual: Erros): Erros => {
    if (!(campo in atual)) return atual;
    const { [campo]: _, ...resto } = atual;
    return resto;
  };
}
