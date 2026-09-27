import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { useSessao } from "@/lib/sessao";
import { Botao, Campo } from "@/components/app/ui";
import { Logo, MarcaCompleta } from "@/components/app/marca";
import { CampoSenha } from "@/components/app/campo-senha";
import { transicao } from "@/lib/animacao";
import { BotaoInstalar } from "@/components/app/instalar-app";
import { useFundoVideo } from "@/components/app/fundo-video";

const logo = { url: "/midia/logo-recolhe.png" };

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Recolhe" },
      { name: "description", content: "Acesso à plataforma de gestão de recolhimentos de motocicletas." },
      { property: "og:title", content: "Entrar — Recolhe" },
      { property: "og:description", content: "Acesso da equipe de operação, agentes e locadoras." },
    ],
  }),
  component: Entrar,
});

const CHAVE_EMAIL = "recolhe.ultimo-email";

function destinoPor(papel: string) {
  if (papel === "agente") return "/agente";
  if (papel === "cliente") return "/portal";
  return "/dashboard";
}

const INDICADORES = [
  ["Fila", "distribuição por agente e prioridade"],
  ["Campo", "GPS, checklist e evidência fotográfica"],
  ["Auditoria", "histórico imutável de cada ordem"],
] as const;

function Entrar() {
  const { entrar, usuario } = useSessao();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const campoEmail = useRef<HTMLInputElement>(null);

  // Login é a tela onde a cena de fundo aparece com mais força.
  useFundoVideo("alta");

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_EMAIL);
    if (salvo) setEmail(salvo);
    else campoEmail.current?.focus();
  }, []);

  useEffect(() => {
    if (usuario) navigate({ to: destinoPor(usuario.papel), replace: true });
  }, [usuario, navigate]);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await entrar(email, senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível entrar.");
      setSenha("");
      return;
    }
    window.localStorage.setItem(CHAVE_EMAIL, email.trim());
    toast.success("Bem-vindo de volta.");
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(420px,0.85fr)]">
      {/* Painel de marca */}
      <div className="grid-lines relative hidden flex-col overflow-hidden border-r border-border p-10 lg:flex">
        <img
          src={logo.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-32 w-[440px] opacity-[0.055] mix-blend-screen"
        />
        <span className="barra-ouro absolute left-0 top-0 h-[2px] w-40" />
        <MarcaCompleta secreta />

        <div className="mt-auto">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transicao.suave}
            className="max-w-lg font-display text-[42px] uppercase leading-[1.04] tracking-[0.01em]"
          >
            Toda a operação
            <br />
            <span className="texto-ouro">em um só lugar.</span>
          </motion.h2>

          <motion.ul
            initial="inicial"
            animate="animar"
            variants={{ animar: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } }}
            className="mt-8 max-w-lg divide-y divide-border border-y border-border"
          >
            {INDICADORES.map(([titulo, texto]) => (
              <motion.li
                key={titulo}
                variants={{ inicial: { opacity: 0, x: -8 }, animar: { opacity: 1, x: 0, transition: transicao.padrao } }}
                className="grid grid-cols-[86px_minmax(0,1fr)] items-baseline gap-4 py-2.5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{titulo}</span>
                <span className="text-[13px] text-muted-foreground">{texto}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          acesso restrito • registros auditados
        </p>
      </div>

      {/* Formulário */}
      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        {/* Contraste local: mantém a leitura do formulário sem esconder o vídeo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-[1] bg-background/70 backdrop-blur-[2px] lg:border-l lg:border-border"
        />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transicao.suave}
          className="mx-auto w-full max-w-[360px]"
        >
          <span className="mb-6 inline-flex lg:hidden">
            <Logo tamanho={34} secreta />
          </span>

          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-primary" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              área restrita
            </span>
          </div>
          <h1 className="mt-2 font-display text-[28px] uppercase leading-none tracking-[0.05em] text-cromo">
            Entrar
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Use suas credenciais da operação.</p>

          <form onSubmit={submeter} className="mt-7 space-y-4" noValidate>
            <Campo rotulo="E-mail">
              <input
                ref={campoEmail}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                required
                aria-invalid={erro ? true : undefined}
                className="campo"
              />
            </Campo>

            <Campo rotulo="Senha">
              <CampoSenha
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                autoComplete="current-password"
                required
                aria-invalid={erro ? true : undefined}
                className="campo"
              />
            </Campo>

            {capsLock && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transicao.rapida}
                className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-warning"
              >
                <AlertTriangle className="size-3" aria-hidden /> caps lock ativado
              </motion.p>
            )}

            <div aria-live="polite" className="min-h-0">
              {erro && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transicao.rapida}
                  className="border-l-2 border-destructive bg-destructive/8 px-3 py-2 text-[12.5px] text-destructive"
                  role="alert"
                >
                  {erro}
                </motion.p>
              )}
            </div>

            <Botao type="submit" carregando={enviando} tamanho="lg" className="group w-full">
              {enviando ? "Verificando…" : "Acessar"}
              {!enviando && (
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              )}
            </Botao>
          </form>

          <BotaoInstalar className="mt-5" />

          <p className="mt-8 border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            acesso restrito • registros auditados
          </p>
        </motion.div>
      </div>
    </div>
  );
}
