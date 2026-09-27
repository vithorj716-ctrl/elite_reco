import { useEffect } from "react";
import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { useDados, useSessao } from "@/lib/sessao";
import { sistemaBloqueado } from "@/components/app/painel-secreto";
import { Logo } from "@/components/app/marca";
import { transicao } from "@/lib/animacao";

/**
 * Aviso de mensalidade vencida: cobre a tela inteira e não pode ser fechado.
 * Administradores continuam com acesso normal.
 */
export function BloqueioSistema() {
  const { banco } = useDados();
  const { usuario } = useSessao();
  const ativo = !!usuario && usuario.papel === "super_admin" && sistemaBloqueado(banco.configuracoes);

  useEffect(() => {
    if (!ativo) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const bloquear = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", bloquear, true);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", bloquear, true);
    };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Sistema bloqueado"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-5 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transicao.suave}
        className="w-full max-w-[440px] border border-destructive/60 bg-surface p-7 text-center shadow-cromo"
      >
        <span className="mx-auto flex size-12 items-center justify-center border border-destructive/60 bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
        </span>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
          acesso suspenso
        </p>
        <h1 className="mt-2 font-display text-[26px] uppercase leading-none tracking-[0.05em] text-cromo">
          Mensalidade vencida
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
          A mensalidade do banco de dados está em atraso e o sistema foi suspenso. Regularize o
          pagamento para liberar o acesso da operação.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2 border-t border-border pt-4">
          <Logo tamanho={26} />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            regularize o pagamento para continuar
          </p>
        </div>
      </motion.div>
    </div>
  );
}
