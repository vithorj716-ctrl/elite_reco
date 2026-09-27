import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Botao, Campo } from "@/components/app/ui";
import { CampoSenha } from "@/components/app/campo-senha";
import { useDados } from "@/lib/sessao";
import { CHAVE_BLOQUEIO, definirBloqueio, lerBloqueio } from "@/lib/bloqueio.functions";
import { transicao } from "@/lib/animacao";

export { CHAVE_BLOQUEIO };
const SENHA = "12345678";

export function sistemaBloqueado(configuracoes: Record<string, string>) {
  return configuracoes[CHAVE_BLOQUEIO] === "1";
}

/** Painel oculto: liberado após 10 toques na marca + senha. */
export function PainelSecreto({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { sincronizar } = useDados();
  const [senha, setSenha] = useState("");
  const [liberado, setLiberado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ligado, setLigado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await lerBloqueio();
      setLigado(r.ligado);
    } catch {
      /* silencioso: painel restrito */
    }
  }, []);

  useEffect(() => {
    if (!aberto) {
      setSenha("");
      setLiberado(false);
      setErro(null);
    }
  }, [aberto]);

  async function alternar() {
    setSalvando(true);
    try {
      const r = await definirBloqueio({ data: { senha: SENHA, ligado: !ligado } });
      setLigado(r.ligado);
      sincronizar("configuracoes");
      sincronizar();
      toast.success(r.ligado ? "Sistema bloqueado." : "Sistema liberado.");
    } catch {
      toast.error("Não foi possível alterar a chave.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={transicao.padrao}
            role="dialog"
            aria-modal="true"
            aria-label="Painel restrito"
            className="relative w-full max-w-[380px] border border-border-strong bg-surface p-6 shadow-cromo"
          >
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="press absolute right-3 top-3 text-muted-foreground hover:text-primary"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-primary" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                painel restrito
              </span>
            </div>

            {!liberado ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (senha === SENHA) {
                    setLiberado(true);
                    setErro(null);
                    void carregar();
                  } else {
                    setErro("Senha incorreta.");
                  }
                }}
              >
                <Campo rotulo="Senha">
                  <CampoSenha
                    autoFocus
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="campo"
                  />
                </Campo>
                {erro && <p className="text-[12.5px] text-destructive">{erro}</p>}
                <Botao type="submit" className="w-full">
                  Entrar
                </Botao>
              </form>
            ) : (
              <div className="mt-4 space-y-5">
                <div>
                  <h2 className="font-display text-[20px] uppercase tracking-[0.05em] text-cromo">
                    Chave do sistema
                  </h2>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Ao ligar, o administrador vê o aviso de mensalidade vencida e fica sem acesso ao
                    sistema. Os demais continuam trabalhando normalmente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={alternar}
                  disabled={salvando}
                  aria-pressed={ligado}
                  className="press flex w-full items-center justify-between border border-border-strong bg-surface-raised px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <ShieldAlert
                      className={ligado ? "size-4 text-destructive" : "size-4 text-muted-foreground"}
                      aria-hidden
                    />
                    {ligado ? "Sistema bloqueado" : "Sistema liberado"}
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      ligado ? "bg-destructive" : "bg-border-strong"
                    }`}
                  >
                    <motion.span
                      layout
                      transition={transicao.rapida}
                      className="absolute top-1 size-4 rounded-full bg-foreground"
                      style={{ left: ligado ? 26 : 4 }}
                    />
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
