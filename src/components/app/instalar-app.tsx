import { AnimatePresence, motion } from "motion/react";
import { Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/app/ui";
import { useInstalacaoPwa } from "@/lib/instalacao";
import { transicao } from "@/lib/animacao";
import { cn } from "@/lib/utils";

/**
 * Botão de instalação do app (Android). Usa exclusivamente o prompt nativo
 * do navegador (beforeinstallprompt). Quando o prompt não está disponível,
 * revela a instrução específica do navegador — sem popups próprios.
 */
export function BotaoInstalar({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  const { podeMostrar, suportaPrompt, instalar, instrucao, rotuloNavegador } = useInstalacaoPwa();
  const [dica, setDica] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!podeMostrar) return null;

  async function aoClicar() {
    if (!suportaPrompt) {
      setDica((v) => !v);
      return;
    }
    setOcupado(true);
    const r = await instalar();
    setOcupado(false);
    if (r === "accepted") toast.success("Aplicativo instalado.");
    else if (r === "indisponivel") setDica(true);
  }

  return (
    <div className={cn("w-full", className)}>
      <Botao
        type="button"
        onClick={aoClicar}
        carregando={ocupado}
        variante={compacto ? "linha" : "cromo"}
        tamanho={compacto ? "sm" : "lg"}
        className={cn("group w-full", compacto && "justify-start")}
      >
        {!ocupado && <Smartphone className="size-4 transition-transform group-hover:-translate-y-px" aria-hidden />}
        Instalar aplicativo
      </Botao>

      <AnimatePresence initial={false}>
        {dica && !suportaPrompt && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transicao.padrao}
            className="overflow-hidden border-l-2 border-primary bg-surface-raised px-3 py-2 text-[12px] text-muted-foreground"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
              {rotuloNavegador}
            </span>
            <br />
            {instrucao}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
