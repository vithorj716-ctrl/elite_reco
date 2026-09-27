/**
 * Máscara e conversão monetária — nenhum campo numérico com setinhas no sistema.
 * O usuário digita os números e o valor é montado em centavos.
 */

export const moedaBR = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Digitação livre → número. "R$ 1.234,50" → 1234.5 */
export function lerMoeda(texto: string): number {
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return 0;
  return Number(digitos) / 100;
}

/** Número → texto mascarado exibido no campo. */
export function escreverMoeda(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  return moedaBR(valor);
}

/** Percentuais também são digitados, nunca incrementados. */
export function lerPercentual(texto: string): number {
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return 0;
  return Number(digitos) / 100;
}

export const escreverPercentual = (valor: number) =>
  `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
export const dataHoraBR = (iso: string) => new Date(iso).toLocaleString("pt-BR");
