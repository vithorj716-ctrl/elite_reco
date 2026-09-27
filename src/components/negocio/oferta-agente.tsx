/**
 * Oferta de serviço para o agente de campo.
 *
 * O agente só decide três coisas: aceitar, recusar (com motivo) e indicar o
 * auxiliar. Valor, serviço e troca de responsável são sempre da central.
 */
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bike, ClipboardCheck, Check, UserPlus, X } from "lucide-react";
import { Botao, Modal, Selo, suave } from "@/components/app/ui";
import { DistribuicaoService } from "@/services/distribuicao.service";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { dinheiroExato } from "@/domain/services/financeiro";
import type { Distribuicao } from "@/domain/types";

export function OfertasAgente() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const meuId = usuario?.agenteId;

  const pendentes = useMemo(
    () =>
      banco.distribuicoes.filter(
        (d) =>
          d.agenteId === meuId &&
          (d.status === "distribuida" || d.status === "notificada"),
      ),
    [banco.distribuicoes, meuId],
  );

  const emCurso = useMemo(
    () => banco.distribuicoes.filter((d) => d.agenteId === meuId && d.status === "aceita"),
    [banco.distribuicoes, meuId],
  );

  if (!meuId || (pendentes.length === 0 && emCurso.length === 0)) return null;

  return (
    <section className="mb-4 space-y-px bg-border" aria-label="Serviços distribuídos para você">
      {pendentes.map((d, i) => (
        <Oferta key={d.id} distribuicao={d} indice={i} aoMudar={() => sincronizar()} />
      ))}
      {emCurso.map((d) => (
        <EscolherAuxiliar
          key={d.id}
          distribuicao={d}
          meuId={meuId}
          aoMudar={() => sincronizar()}
        />
      ))}
    </section>
  );
}

function Cabecalho({ distribuicao }: { distribuicao: Distribuicao }) {
  const banco = useBanco();
  const locadora = banco.locadoras.find((l) => l.id === distribuicao.locadoraId);
  const moto = banco.motos.find((m) => m.id === distribuicao.motoId);
  const Icone = distribuicao.tipo === "vistoria" ? ClipboardCheck : Bike;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Icone className="size-4 text-primary" aria-hidden />
      <span className="font-mono text-[15px] text-foreground">{moto?.placa ?? "—"}</span>
      <Selo tom="primario">{distribuicao.servicoNome}</Selo>
      <span className="text-[12px] text-muted-foreground">{locadora?.nome}</span>
      <div className="ml-auto text-right">
        <span className="font-mono text-[14px] tabular-nums text-primary">
          {dinheiroExato(distribuicao.valorPagamento)}
        </span>
        <p className="text-[11px] text-muted-foreground">
          {distribuicao.valorPagamentoAdicional > 0
            ? `Base ${dinheiroExato(distribuicao.valorPagamentoBase)} + adicional ${dinheiroExato(
                distribuicao.valorPagamentoAdicional,
              )}`
            : "Valor do seu repasse"}
        </p>
      </div>
    </div>
  );
}

function Oferta({
  distribuicao,
  indice,
  aoMudar,
}: {
  distribuicao: Distribuicao;
  indice: number;
  aoMudar: () => void;
}) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function aceitar() {
    setOcupado(true);
    try {
      await DistribuicaoService.aceitar(distribuicao.id);
      aoMudar();
      toast.success("Serviço aceito. Ele já está na sua lista.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function recusar() {
    setOcupado(true);
    try {
      await DistribuicaoService.recusar(distribuicao.id, motivo);
      aoMudar();
      setRecusando(false);
      setMotivo("");
      toast.success("Serviço devolvido. A central já sorteou outro agente.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...suave, delay: indice * 0.05 }}
      className="border-l-2 border-l-primary bg-surface p-4"
    >
      <p className="label-caps mb-2 text-primary">Novo serviço para você</p>
      <Cabecalho distribuicao={distribuicao} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao variante="solido" tamanho="sm" carregando={ocupado} onClick={aceitar}>
          <Check className="size-4" /> Aceitar
        </Botao>
        <Botao variante="linha" tamanho="sm" disabled={ocupado} onClick={() => setRecusando(true)}>
          <X className="size-4" /> Recusar
        </Botao>
      </div>

      <Modal
        aberto={recusando}
        aoFechar={() => setRecusando(false)}
        titulo="Recusar serviço"
        descricao="A central é avisada e outro agente é sorteado imediatamente."
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setRecusando(false)}>
              Voltar
            </Botao>
            <Botao variante="solido" carregando={ocupado} onClick={recusar}>
              Confirmar recusa
            </Botao>
          </>
        }
      >
        <label className="label-caps" htmlFor={`motivo-${distribuicao.id}`}>
          Motivo da recusa
        </label>
        <textarea
          id={`motivo-${distribuicao.id}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="campo mt-2 w-full"
          placeholder="Ex.: estou em outro atendimento na região oposta"
        />
      </Modal>
    </motion.article>
  );
}

function EscolherAuxiliar({
  distribuicao,
  meuId,
  aoMudar,
}: {
  distribuicao: Distribuicao;
  meuId: string;
  aoMudar: () => void;
}) {
  const banco = useBanco();
  const [aberto, setAberto] = useState(false);
  const [auxiliarId, setAuxiliarId] = useState(distribuicao.agenteAuxiliarId ?? "");
  const [ocupado, setOcupado] = useState(false);
  const auxiliar = banco.agentes.find((a) => a.id === distribuicao.agenteAuxiliarId);

  async function salvar() {
    setOcupado(true);
    try {
      await DistribuicaoService.definirAuxiliar(distribuicao.id, auxiliarId || null);
      aoMudar();
      setAberto(false);
      toast.success(auxiliarId ? "Auxiliar definido." : "Auxiliar removido.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="bg-surface p-4">
      <Cabecalho distribuicao={distribuicao} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">
          Auxiliar: {auxiliar ? auxiliar.nome : "nenhum"}
        </span>
        <Botao
          variante="linha"
          tamanho="sm"
          className="ml-auto"
          onClick={() => setAberto(true)}
        >
          <UserPlus className="size-4" /> {auxiliar ? "Trocar auxiliar" : "Chamar auxiliar"}
        </Botao>
      </div>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Agente auxiliar"
        descricao="O auxiliar recebe o mesmo valor do agente principal nesta operação."
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="solido" carregando={ocupado} onClick={salvar}>
              Salvar
            </Botao>
          </>
        }
      >
        <select
          value={auxiliarId}
          onChange={(e) => setAuxiliarId(e.target.value)}
          aria-label="Escolher agente auxiliar"
          className="campo w-full"
        >
          <option value="">Sem auxiliar</option>
          {banco.agentes
            .filter((a) => a.id !== meuId && a.ativo)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} — {a.cidade}
              </option>
            ))}
        </select>
      </Modal>
    </article>
  );
}
