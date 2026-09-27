/**
 * Seleção de locadora com busca — usa somente locadoras já cadastradas.
 * Nada aqui cadastra locadora: é apenas a escolha de um registro existente.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locadora } from "@/domain/types";

export function SeletorLocadora({
  rotulo = "Locadora",
  valor,
  locadoras,
  aoEscolher,
  bloqueado = false,
  erro,
  className,
}: {
  rotulo?: string;
  valor: string;
  locadoras: Locadora[];
  aoEscolher: (id: string) => void;
  bloqueado?: boolean;
  erro?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  const escolhida = locadoras.find((l) => l.id === valor);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = [...locadoras].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!termo) return base;
    return base.filter((l) =>
      [l.nome, l.cidade, l.cnpj].some((t) => (t ?? "").toLowerCase().includes(termo)),
    );
  }, [locadoras, busca]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div
      ref={caixa}
      {...(erro ? { "data-campo-invalido": "1" } : {})}
      className={cn(
        "relative block bg-surface px-4 py-3",
        erro && "bg-destructive/10 ring-1 ring-inset ring-destructive/60",
        className,
      )}
    >
      <span className={cn("label-caps", erro && "text-destructive")}>{rotulo}</span>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => {
          setBusca("");
          setAberto((a) => !a);
        }}
        className={cn(
          "mt-1.5 flex w-full items-center justify-between gap-2 border-b border-border pb-1 text-left text-[13px] transition-colors",
          bloqueado ? "opacity-60" : "hover:border-primary",
          erro && "border-destructive",
        )}
      >
        <span className={escolhida ? "truncate text-foreground" : "truncate text-muted-foreground"}>
          {escolhida?.nome ?? "Selecionar locadora"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {erro && (
        <span className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="mt-[1px] size-3 shrink-0" />
          {erro}
        </span>
      )}


      {aberto && !bloqueado && (
        <div className="absolute left-4 right-4 top-full z-30 mt-1 border border-border-strong bg-surface shadow-cromo">
          <div className="relative border-b border-border">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar locadora"
              className="w-full bg-transparent py-2 pl-8 pr-3 text-[13px] outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="rolagem-y max-h-56">
            {lista.length === 0 ? (
              <p className="px-3 py-3 text-[12.5px] text-muted-foreground">
                Nenhuma locadora encontrada.
              </p>
            ) : (
              lista.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    aoEscolher(l.id);
                    setAberto(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{l.nome}</span>
                    {l.cidade && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {l.cidade}
                        {l.uf ? ` · ${l.uf}` : ""}
                      </span>
                    )}
                  </span>
                  {l.id === valor && <Check className="size-3.5 text-primary" aria-hidden />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
