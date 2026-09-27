/**
 * Campos monetários e percentuais do sistema. Sempre digitação com máscara —
 * nunca <input type="number"> com controles de incremento.
 */
import { useEffect, useState } from "react";
import { escreverMoeda, escreverPercentual, lerMoeda, lerPercentual } from "@/lib/moeda";
import { cn } from "@/lib/utils";

const base =
  "w-full border-b border-border bg-transparent pb-1 text-right font-mono text-[13px] tabular-nums text-foreground outline-none transition-colors focus:border-primary disabled:opacity-60";

function useMascara(valor: number, escrever: (v: number) => string) {
  const [texto, setTexto] = useState(() => escrever(valor));
  const [focado, setFocado] = useState(false);
  useEffect(() => {
    if (!focado) setTexto(escrever(valor));
  }, [valor, focado, escrever]);
  return { texto, setTexto, focado, setFocado };
}

interface PropsMoeda {
  valor: number;
  aoAlterar: (v: number) => void;
  aoConfirmar?: (v: number) => void;
  rotulo?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** Entrada monetária mascarada: o usuário digita 4500 e vê R$ 45,00. */
export function CampoMoeda({
  valor,
  aoAlterar,
  aoConfirmar,
  rotulo,
  placeholder = "R$ 0,00",
  disabled,
  className,
  id,
}: PropsMoeda) {
  const { texto, setTexto, setFocado } = useMascara(valor, escreverMoeda);

  const campo = (
    <input
      id={id ?? ""}
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled ?? false}
      placeholder={placeholder}
      value={texto}
      onFocus={() => setFocado(true)}
      onChange={(e) => {
        const numero = lerMoeda(e.target.value);
        setTexto(escreverMoeda(numero));
        aoAlterar(numero);
      }}
      onBlur={() => {
        setFocado(false);
        setTexto(escreverMoeda(valor));
        aoConfirmar?.(valor);
      }}
      className={cn(base, className)}
    />
  );

  if (!rotulo) return campo;
  return (
    <label className="block bg-surface px-4 py-3">
      <span className="label-caps">{rotulo}</span>
      <div className="mt-1.5">{campo}</div>
    </label>
  );
}

/** Entrada percentual mascarada — mesmo padrão do campo monetário. */
export function CampoPercentual({
  valor,
  aoAlterar,
  rotulo,
  disabled,
  className,
}: {
  valor: number;
  aoAlterar: (v: number) => void;
  rotulo?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { texto, setTexto, setFocado } = useMascara(valor, escreverPercentual);
  const campo = (
    <input
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled ?? false}
      placeholder="0,00%"
      value={texto}
      onFocus={() => setFocado(true)}
      onChange={(e) => {
        const numero = lerPercentual(e.target.value);
        setTexto(escreverPercentual(numero));
        aoAlterar(numero);
      }}
      onBlur={() => {
        setFocado(false);
        setTexto(escreverPercentual(valor));
      }}
      className={cn(base, className)}
    />
  );
  if (!rotulo) return campo;
  return (
    <label className="block bg-surface px-4 py-3">
      <span className="label-caps">{rotulo}</span>
      <div className="mt-1.5">{campo}</div>
    </label>
  );
}
