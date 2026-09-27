/**
 * "Tipos de serviço que aceito" — app do agente.
 *
 * O agente liga/desliga cada tipo de serviço e vê quanto recebe por ele. O
 * valor vem da tabela de remuneração do administrador e é somente leitura:
 * aqui não existe qualquer forma de alterá-lo.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ListChecks } from "lucide-react";
import { PreferenciasAgenteService } from "@/services/preferencias-agente.service";
import { dinheiroExato } from "@/domain/services/financeiro";
import { useSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

export function ServicosAceitos() {
  const { usuario } = useSessao();
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicosAgente", usuario?.agenteId],
    queryFn: () => PreferenciasAgenteService.listar(),
    enabled: Boolean(usuario?.agenteId),
  });

  const alternar = useMutation({
    mutationFn: ({ id, aceita }: { id: string; aceita: boolean }) =>
      PreferenciasAgenteService.definir(id, aceita),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["servicosAgente"] });
      void qc.invalidateQueries({ queryKey: ["banco"] });
      toast.success(v.aceita ? "Serviço ativado para você." : "Serviço desativado para você.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!usuario?.agenteId || servicos.length === 0) return null;

  const ativos = servicos.filter((s) => s.aceita).length;

  return (
    <section className="mb-4 border border-border bg-surface">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="press flex w-full items-center gap-3 p-4 text-left"
      >
        <ListChecks className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">
          <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Tipos de serviço que aceito
          </span>
          <span className="mt-1 block text-[13px] text-foreground">
            {ativos} de {servicos.length} serviços ativos
          </span>
        </span>
        <ChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>

      {aberto && (
        <ul className="space-y-px border-t border-border bg-border">
          {servicos.map((s) => (
            <li key={s.servicoId} className="flex items-center gap-3 bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">{s.nome}</p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  você recebe {dinheiroExato(s.valor)}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={s.aceita}
                aria-label={`Aceitar ${s.nome}`}
                disabled={alternar.isPending}
                onClick={() => alternar.mutate({ id: s.servicoId, aceita: !s.aceita })}
                className={cn(
                  "press border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                  s.aceita
                    ? "border-success/50 text-success"
                    : "border-border-strong text-muted-foreground",
                )}
              >
                {s.aceita ? "Aceito" : "Não aceito"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        Os valores são definidos pela central nas tabelas de remuneração. Você escolhe apenas quais
        serviços quer receber.
      </p>
    </section>
  );
}
