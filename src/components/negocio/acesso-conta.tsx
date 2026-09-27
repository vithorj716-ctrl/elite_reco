/**
 * Bloco de acesso de uma conta: mostra o login (e-mail) e permite que o
 * administrador defina uma nova senha quando alguém esquecer.
 *
 * Importante: a senha nunca é armazenada em texto — o autenticador guarda
 * apenas um resumo criptográfico. Por isso não existe "ver senha atual";
 * o caminho seguro é gerar/definir uma nova e entregá-la à pessoa.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { Botao, Modal } from "@/components/app/ui";
import { CampoSenha } from "@/components/app/campo-senha";
import { redefinirSenha } from "@/lib/usuarios.functions";

function gerarSenha() {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (n) => alfabeto[n % alfabeto.length]).join("");
}

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copiar ${rotulo}`}
      onClick={async () => {
        await navigator.clipboard.writeText(valor);
        setOk(true);
        toast.success(`${rotulo} copiado.`);
        setTimeout(() => setOk(false), 1500);
      }}
      className="press text-muted-foreground hover:text-primary"
    >
      {ok ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function AcessoConta({
  id,
  nome,
  email,
  compacto = false,
}: {
  id: string;
  nome: string;
  email: string;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [definida, setDefinida] = useState<string | null>(null);

  function abrir() {
    setSenha(gerarSenha());
    setDefinida(null);
    setAberto(true);
  }

  async function confirmar() {
    if (senha.trim().length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      await redefinirSenha({ data: { id, senha: senha.trim() } });
      setDefinida(senha.trim());
      toast.success("Nova senha definida.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Gerenciar acesso de ${nome}`}
        className="press inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-primary"
      >
        <KeyRound className="size-3.5" />
        {!compacto && "senha"}
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Acesso de ${nome}`}
        descricao="Login e definição de nova senha"
      >
        <div className="space-y-4 px-4 py-4">
          <div className="border border-border bg-surface-raised px-3 py-2">
            <span className="label-caps">Usuário (login)</span>
            <p className="mt-1 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{email}</span>
              <Copiar valor={email} rotulo="Login" />
            </p>
          </div>

          {definida ? (
            <div className="border border-success/40 bg-success/8 px-3 py-2">
              <span className="label-caps">Nova senha ativa</span>
              <p className="mt-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-success">
                  {definida}
                </span>
                <Copiar valor={definida} rotulo="Senha" />
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Anote e entregue agora: por segurança, ela não poderá ser consultada depois.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">
                A senha atual não pode ser exibida — fica guardada de forma criptografada. Para
                recuperar o acesso, defina uma nova senha abaixo e informe à pessoa.
              </p>
              <label className="block">
                <span className="label-caps">Nova senha</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <CampoSenha
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="campo flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setSenha(gerarSenha())}
                    aria-label="Gerar outra senha"
                    className="press text-muted-foreground hover:text-primary"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
              </label>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Botao variante="linha" onClick={() => setAberto(false)}>
            {definida ? "Fechar" : "Cancelar"}
          </Botao>
          {!definida && (
            <Botao onClick={() => void confirmar()} carregando={salvando}>
              Definir senha
            </Botao>
          )}
        </div>
      </Modal>
    </>
  );
}
