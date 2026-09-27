/**
 * Transferência de responsabilidade de uma ordem entre agentes.
 *
 * A tela apenas coleta a intenção: quem pode transferir, quais situações
 * permitem a troca e o registro no histórico são decididos pelo banco.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Check } from "lucide-react";
import { Botao, Modal } from "@/components/app/ui";
import { AvatarAgente } from "@/components/negocio/foto-agente";
import { ROTULO_ESTADO_AGENTE, desde, estadoAgente } from "@/domain/services/presenca";
import { useBanco, useSincronizar } from "@/lib/sessao";
import { OrdensService } from "@/services/ordens.service";
import type { Ordem } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Situações em que a troca operacional é permitida. */
export function podeTransferirAgente(ordem: Ordem) {
  return (
    !ordem.recebimentoPago &&
    !ordem.pagamentoPago &&
    (ordem.status === "liberada" ||
      ordem.status === "distribuida" ||
      ordem.status === "em_andamento")
  );
}

export function ModalTransferirAgente({
  ordem,
  aberto,
  aoFechar,
}: {
  ordem: Ordem;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [novoId, setNovoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const atual = banco.agentes.find((a) => a.id === ordem.agenteId);
  const emRota = ordem.status === "em_andamento";

  const candidatos = useMemo(
    () => banco.agentes.filter((a) => a.ativo && a.id !== ordem.agenteId),
    [banco.agentes, ordem.agenteId],
  );

  const escolhido = candidatos.find((a) => a.id === novoId);

  function fechar() {
    setNovoId("");
    setMotivo("");
    aoFechar();
  }

  async function transferir() {
    if (!escolhido) return;
    setEnviando(true);
    try {
      await OrdensService.transferirAgente(ordem, escolhido.id, motivo);
      sincronizar(["ordens", "ordem_historico"]);
      toast.success(`Ordem transferida para ${escolhido.nome}.`);
      fechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Transferir agente da ordem"
      descricao={`${ordem.placa} • ${ordem.codigo}`}
      largura="max-w-lg"
      rodape={
        <div className="flex justify-end gap-2">
          <Botao variante="linha" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao
            variante="solido"
            disabled={!escolhido}
            carregando={enviando}
            onClick={() => void transferir()}
          >
            <ArrowLeftRight className="size-4" />
            {escolhido ? `Transferir para ${escolhido.nome.split(" ")[0]}` : "Transferir"}
          </Botao>
        </div>
      }
    >
      {emRota && (
        <p className="border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-[12.5px] text-foreground">
          Esta ordem está <strong>em andamento</strong>: a transferência acontece durante uma rota
          ativa. Os horários de aceite, deslocamento e chegada já registrados são preservados, e o
          agente atual deixa de ter acesso à ordem imediatamente.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 border border-border bg-surface px-4 py-3">
        <AvatarAgente foto={atual?.foto} nome={atual?.nome} tamanho={36} />
        <div className="min-w-0">
          <p className="label-caps">Agente atual</p>
          <p className="truncate text-[13px]">{atual?.nome ?? "ordem sem agente"}</p>
          {atual && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {atual.cidade || "cidade não informada"} ·{" "}
              {ROTULO_ESTADO_AGENTE[estadoAgente(banco, atual)].toLowerCase()} · {desde(atual.vistoEm)}
            </p>
          )}
        </div>
      </div>

      <p className="label-caps mt-4">Novo agente responsável</p>
      {candidatos.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Nenhum outro agente ativo disponível.
        </p>
      ) : (
        <ul className="mt-2 max-h-60 divide-y divide-border overflow-y-auto border border-border">
          {candidatos.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setNovoId(novoId === a.id ? "" : a.id)}
                className={cn(
                  "press grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-raised",
                  novoId === a.id && "bg-primary/10",
                )}
              >
                <AvatarAgente foto={a.foto} nome={a.nome} tamanho={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-foreground">{a.nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {a.cidade || "cidade não informada"} ·{" "}
                    {ROTULO_ESTADO_AGENTE[estadoAgente(banco, a)].toLowerCase()} · {desde(a.vistoEm)}
                  </span>
                </span>
                <Check
                  className={cn(
                    "size-3.5 shrink-0 text-primary transition-opacity",
                    novoId === a.id ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 block">
        <span className="label-caps">Motivo da transferência (opcional)</span>
        <textarea
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: agente sem condição de seguir a rota"
          className="mt-1.5 w-full resize-none border border-border bg-transparent px-3 py-2 text-[13px] outline-none transition-colors focus:border-primary"
        />
      </label>

      <p className="mt-3 text-[12px] text-muted-foreground">
        A ordem continua a mesma — código, placa, fotos, checklist, financeiro e histórico
        permanecem. A transferência é registrada no histórico com o agente anterior, o novo agente,
        quem executou e o horário.
      </p>
    </Modal>
  );
}
