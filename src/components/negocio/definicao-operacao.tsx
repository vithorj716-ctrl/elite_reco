/**
 * Definição da operação pelo administrador.
 *
 * Um recolhimento lançado não é uma operação precificada: ele fica aqui até que
 * o administrador confirme os dois lados financeiros — cobrança da locadora e
 * repasse do agente — cada um com valor base e adicional independentes. As
 * tabelas de remuneração continuam sendo apenas a REFERÊNCIA mostrada em tela;
 * o que vale depois é o valor gravado na própria operação.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, ShieldCheck } from "lucide-react";
import { Botao, Modal, Selo } from "@/components/app/ui";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { DistribuicaoService } from "@/services/distribuicao.service";
import { dinheiroExato } from "@/domain/services/financeiro";
import { useBanco } from "@/lib/sessao";
import { CHAVES, PADRAO_HORARIO_ESPECIAL } from "@/services/configuracoes.service";
import type { Distribuicao } from "@/domain/types";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="label-caps">{rotulo}</span>
      <span className="text-right text-[13px] text-foreground">{valor || "—"}</span>
    </div>
  );
}

export function DefinicaoOperacao({
  distribuicao,
  aoFechar,
  aoConcluir,
}: {
  distribuicao: Distribuicao | null;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const banco = useBanco();
  const [cobrancaBase, setCobrancaBase] = useState(0);
  const [cobrancaAdicional, setCobrancaAdicional] = useState(0);
  const [pagamentoBase, setPagamentoBase] = useState(0);
  const [pagamentoAdicional, setPagamentoAdicional] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // A referência entra pronta nos campos; o administrador ajusta o que quiser.
  useEffect(() => {
    if (!distribuicao) return;
    setCobrancaBase(distribuicao.referenciaCobranca);
    setCobrancaAdicional(distribuicao.referenciaAdicionalCobranca);
    setPagamentoBase(distribuicao.referenciaPagamento);
    setPagamentoAdicional(distribuicao.referenciaAdicionalPagamento);
    setMotivo("");
  }, [distribuicao]);

  const ordem = banco.ordens.find((o) => o.id === distribuicao?.ordemId);
  const vistoria = banco.vistorias.find((v) => v.id === distribuicao?.vistoriaId);
  const locadora = banco.locadoras.find((l) => l.id === distribuicao?.locadoraId);
  const moto = banco.motos.find((m) => m.id === distribuicao?.motoId);
  const placa = ordem?.placa ?? moto?.placa ?? "—";
  const horario = distribuicao
    ? new Date(distribuicao.criadaEm).toLocaleString("pt-BR")
    : "—";
  const inicioEspecial =
    banco.configuracoes[CHAVES.horarioEspecialInicio] ?? PADRAO_HORARIO_ESPECIAL;

  const totalCobranca = cobrancaBase + cobrancaAdicional;
  const totalPagamento = pagamentoBase + pagamentoAdicional;

  async function confirmar() {
    if (!distribuicao) return;
    setOcupado(true);
    try {
      await DistribuicaoService.aprovar(distribuicao.id, {
        cobrancaBase,
        cobrancaAdicional,
        pagamentoBase,
        pagamentoAdicional,
        motivo,
      });
      aoConcluir();
      toast.success("Operação liberada. Os agentes elegíveis já podem recebê-la.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      aberto={!!distribuicao}
      aoFechar={aoFechar}
      largura="max-w-2xl"
      titulo="Definir e liberar operação"
      descricao="Nenhum agente enxerga esta operação antes da sua confirmação. Os valores escolhidos ficam gravados nela para sempre."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="solido" carregando={ocupado} onClick={confirmar}>
            <ShieldCheck className="size-4" /> Confirmar e liberar operação
          </Botao>
        </>
      }
    >
      {distribuicao && (
        <div className="space-y-4">
          {distribuicao.horarioEspecial ? (
            <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <p className="text-[13px] text-foreground">
                Esta operação foi lançada após {inicioEspecial}, por isso ela pede a sua
                confirmação antes de ir para os agentes. Os adicionais abaixo são só sugestão —
                vale o que você confirmar. Lançamentos antes de {inicioEspecial} seguem direto
                pela tabela, sem passar por aqui.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 border border-border bg-surface px-3 py-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-[13px] text-muted-foreground">
                Lançamento antes de {inicioEspecial}. Confirme os valores apenas porque a tabela
                de preços não tem valor para este serviço.
              </p>
            </div>
          )}

          <section className="border border-border bg-surface px-3 py-2">
            <Linha rotulo="Locadora" valor={locadora?.nome ?? "—"} />
            <Linha rotulo="Placa" valor={placa} />
            <Linha rotulo="Serviço" valor={distribuicao.servicoNome} />
            <Linha rotulo="Horário do lançamento" valor={horario} />
            <Linha
              rotulo="Motocicleta"
              valor={
                ordem
                  ? [ordem.marca, ordem.modelo, ordem.ano, ordem.cor].filter(Boolean).join(" • ")
                  : [moto?.marca, moto?.modelo, moto?.ano, moto?.cor].filter(Boolean).join(" • ")
              }
            />
            <Linha
              rotulo="Localização"
              valor={
                ordem
                  ? [ordem.endereco, ordem.bairro, ordem.cidade, ordem.uf]
                      .filter(Boolean)
                      .join(", ")
                  : [vistoria?.endereco, vistoria?.cidade, vistoria?.uf].filter(Boolean).join(", ")
              }
            />
            <Linha rotulo="Rastreamento" valor={ordem?.linkRastreador ?? ordem?.ultimoRastreio ?? ""} />
            <Linha rotulo="Observações" valor={ordem?.observacoes ?? vistoria?.observacoes ?? ""} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="border border-border p-3">
              <p className="label-caps">Cobrança da locadora</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Referência da tabela: {dinheiroExato(distribuicao.referenciaCobranca)}
                {distribuicao.horarioEspecial &&
                  ` • adicional de referência ${dinheiroExato(distribuicao.referenciaAdicionalCobranca)}`}
              </p>
              <div className="mt-3 space-y-3">
                <CampoMoeda rotulo="Valor base" valor={cobrancaBase} aoAlterar={setCobrancaBase} />
                <CampoMoeda
                  rotulo="Adicional da locadora"
                  valor={cobrancaAdicional}
                  aoAlterar={setCobrancaAdicional}
                />
              </div>
              <p className="mt-3 flex items-baseline justify-between">
                <span className="label-caps">Total da cobrança</span>
                <span className="font-mono text-[14px] tabular-nums text-foreground">
                  {dinheiroExato(totalCobranca)}
                </span>
              </p>
            </div>

            <div className="border border-border p-3">
              <p className="label-caps">Repasse do agente</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Referência da tabela: {dinheiroExato(distribuicao.referenciaPagamento)}
                {distribuicao.horarioEspecial &&
                  ` • adicional de referência ${dinheiroExato(distribuicao.referenciaAdicionalPagamento)}`}
              </p>
              <div className="mt-3 space-y-3">
                <CampoMoeda
                  rotulo="Valor base"
                  valor={pagamentoBase}
                  aoAlterar={setPagamentoBase}
                />
                <CampoMoeda
                  rotulo="Adicional do agente"
                  valor={pagamentoAdicional}
                  aoAlterar={setPagamentoAdicional}
                />
              </div>
              <p className="mt-3 flex items-baseline justify-between">
                <span className="label-caps">Total do repasse</span>
                <span className="font-mono text-[14px] tabular-nums text-primary">
                  {dinheiroExato(totalPagamento)}
                </span>
              </p>
            </div>
          </section>

          <p className="text-[12px] text-muted-foreground">
            <Selo tom="info">Independentes</Selo> A cobrança da locadora e o repasse do agente não
            precisam ser iguais — cada lado é confirmado separadamente.
          </p>

          <label className="block">
            <span className="label-caps">Observação da definição (opcional)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="campo mt-1 w-full"
              placeholder="Registre a razão do valor escolhido"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
