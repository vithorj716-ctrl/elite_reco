import { motion } from "motion/react";
import { useRef, useState } from "react";
const logo = { url: "/midia/logo-recolhe.png" };
import { cn } from "@/lib/utils";
import { transicao } from "@/lib/animacao";
import { PainelSecreto } from "@/components/app/painel-secreto";

/**
 * Marca institucional — pistões cromados + raio âmbar.
 * Com `secreta`, dez toques seguidos abrem o painel restrito (só na tela de acesso).
 */
export function Logo({
  className,
  tamanho = 28,
  secreta = false,
}: {
  className?: string;
  tamanho?: number;
  secreta?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const toques = useRef(0);
  const ultimo = useRef(0);

  function tocar() {
    if (!secreta) return;
    const agora = Date.now();
    toques.current = agora - ultimo.current > 1200 ? 1 : toques.current + 1;
    ultimo.current = agora;
    if (toques.current >= 10) {
      toques.current = 0;
      setAberto(true);
    }
  }

  return (
    <>
      <motion.img
        src={logo.url}
        alt="Recolhe — gestão de recolhimentos"
        width={tamanho}
        height={tamanho}
        draggable={false}
        onClick={tocar}
        whileHover={{ rotate: 6, scale: 1.06 }}
        transition={transicao.padrao}
        className={cn(
          "select-none object-contain mix-blend-screen",
          secreta && "cursor-pointer",
          className,
        )}
        style={{ width: tamanho, height: tamanho }}
      />
      {secreta && <PainelSecreto aberto={aberto} aoFechar={() => setAberto(false)} />}
    </>
  );
}

export function MarcaCompleta({
  compacta = false,
  className,
  secreta = false,
}: {
  compacta?: boolean;
  className?: string;
  secreta?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo tamanho={compacta ? 24 : 30} secreta={secreta} />
      <div className="leading-none">
        <p className="font-display text-[15px] uppercase tracking-[0.16em] text-cromo">Recolhe</p>
        {!compacta && (
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            gestão de recolhimentos
          </p>
        )}
      </div>
    </div>
  );
}
