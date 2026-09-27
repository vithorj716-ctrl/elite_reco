import { Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  className?: string;
}

/** Campo de senha com botão de revelar/ocultar. */
export function CampoSenha({ className, ...props }: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visivel ? "text" : "password"}
        className={cn("w-full pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="press absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={visivel ? "on" : "off"}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
