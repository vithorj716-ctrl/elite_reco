/**
 * Cancelamento pela locadora.
 *
 * Regra operacional: se o agente já iniciou o deslocamento (status verde),
 * o cancelamento gera cobrança de 50% do valor do serviço. O aceite é
 * obrigatório, fica registrado de forma imutável no banco e a cobrança é
 * lançada na própria ordem.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Truck } from "lucide-react";
import { Botao, Modal } from "@/components/app/ui";
import { dinheiro } from "@/domain/services/financeiro";
import { EASE } from "@/lib/animacao";
import { useSincronizar } from "@/lib/sessao";
import { OrdensService } from "@/services/ordens.service";
import type { Ordem } from "@/domain/types";

interface Previa {
  deslocamentoIniciado: boolean;
  valorOriginal: number;
  percentual: number;
  valorCobranca: number;
}

export function ModalCancelamentoLocadora({
  ordem,
  aberto,
  aoFechar,
}: {
  ordem: Ordem | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const sincronizar = useSincronizar();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aceite, setAceite] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !ordem) return;
    setPrevia(null);
    setMotivo("");
    setAceite(false);
    setCarregando(true);
    let vivo = true;
    OrdensService.previaCancelamentoLocadora(ordem.id)
      .then((p) => vivo && setPrevia(p))
      .catch((e: Error) => vivo && toast.error(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [aberto, ordem]);

  const comTaxa = Boolean(previa?.deslocamentoIniciado);
  const textoAceite = comTaxa
    ? `Estou ciente de que o agente já iniciou o deslocamento e aceito a cobrança de ${previa?.percentual ?? 50}% (${dinheiro(previa?.valorCobranca ?? 0)}) referente ao cancelamento da ordem ${ordem?.codigo ?? ""}.`
    : "";

  async function confirmar() {
    if (!ordem) return;
    if (comTaxa && !aceite) {
      toast.error("É obrigatório aceitar a cobrança para prosseguir.");
      return;
    }
    setSalvando(true);
    try {
      const r = await OrdensService.cancelarComoLocadora(ordem, {
        motivo,
        aceite: comTaxa ? aceite : false,
        textoAceite: comTaxa ? textoAceite : "",
      });
      sincronizar(["ordens", "ordem_cobrancas", "ordem_historico", "cancelamentos_ordem"]);
      toast.success(
        r.valorCobranca > 0
          ? `Solicitação cancelada. Taxa de ${dinheiro(r.valorCobranca)} lançada na fatura.`
          : "Solicitação cancelada sem cobrança.",
      );
      aoFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto && !!ordem}
      aoFechar={aoFechar}
      titulo="Cancelar solicitação"
      descricao={ordem ? `${ordem.codigo} • ${ordem.placa} — ${ordem.endereco}` : ""}
      rodape={
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            variante="perigo"
            carregando={salvando}
            disabled={carregando || (comTaxa && !aceite)}
            onClick={() => void confirmar()}
          >
            {comTaxa ? "Aceitar a taxa e cancelar" : "Cancelar solicitação"}
          </Botao>
        </div>
      }
    >
      {carregando ? (
        <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> conferindo a situação em campo…
        </p>
      ) : comTaxa ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3 border border-warning/40 bg-warning/10 p-3">
            <Truck className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-[13px] font-medium text-foreground">
                O agente já está a caminho do local
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Depois do início do deslocamento o cancelamento gera cobrança de{" "}
                {previa?.percentual ?? 50}% do valor do serviço.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-px bg-border">
            <div className="bg-surface px-3 py-2.5">
              <dt className="label-caps">Valor do serviço</dt>
              <dd className="mt-1 text-[14px]">{dinheiro(previa?.valorOriginal ?? 0)}</dd>
            </div>
            <div className="bg-surface px-3 py-2.5">
              <dt className="label-caps">Percentual</dt>
              <dd className="mt-1 text-[14px]">{previa?.percentual ?? 50}%</dd>
            </div>
            <div className="bg-surface px-3 py-2.5">
              <dt className="label-caps">Você pagará</dt>
              <dd className="mt-1 font-display text-[18px] text-primary">
                {dinheiro(previa?.valorCobranca ?? 0)}
              </dd>
            </div>
          </dl>

          <label className="block">
            <span className="label-caps">Motivo do cancelamento</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="ex.: cliente quitou o débito"
              className="mt-1.5 w-full resize-none border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={aceite}
              onChange={(e) => setAceite(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
            />
            <span className="text-[12.5px] leading-relaxed text-foreground">{textoAceite}</span>
          </label>

          <p className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />O aceite e o valor
            ficam registrados de forma permanente na ordem e não podem ser alterados depois.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            O agente ainda não iniciou o deslocamento, então este cancelamento não gera cobrança.
          </p>
          <label className="block">
            <span className="label-caps">Motivo do cancelamento</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="ex.: veículo localizado pela própria locadora"
              className="mt-1.5 w-full resize-none border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
