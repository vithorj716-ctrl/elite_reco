import { createFileRoute, Link } from "@tanstack/react-router";
import { AcoesOrdem } from "@/components/negocio/acoes-ordem";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { valorReceber } from "@/domain/services/financeiro";
import { moedaBR } from "@/lib/moeda";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardList, ExternalLink, UserPlus } from "lucide-react";
import {
  Abas,
  BarraFiltros,
  Botao,
  CabecalhoTabela,
  CorpoTabela,
  LinhaTabela,
  Modal,
  Pagina,
  Prioridade_,
  Status,
  Tabela,
  Vazio,
} from "@/components/app/ui";
import { OrdensService } from "@/services/ordens.service";
import {
  ROTULO_ESTADO_AGENTE,
  desde,
  estadoAgente,
} from "@/domain/services/presenca";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import type { StatusOrdem } from "@/domain/types";
import { cn } from "@/lib/utils";
import { nomeServico } from "@/domain/services/catalogo";

export const Route = createFileRoute("/_app/ordens/")({
  head: () => ({
    meta: [
      { title: "Fila de recolhimentos — Recolhe" },
      {
        name: "description",
        content: "Fila operacional com distribuição de ordens de recolhimento aos agentes.",
      },
      { property: "og:title", content: "Fila de recolhimentos — Recolhe" },
      {
        property: "og:description",
        content: "Pendentes, distribuídos, em andamento, concluídos e cancelados.",
      },
    ],
  }),
  component: Fila,
});

const ABAS: Array<{ chave: StatusOrdem | "todas"; rotulo: string }> = [
  { chave: "pendente_definicao", rotulo: "Aguardando definição" },
  { chave: "liberada", rotulo: "Liberados" },
  { chave: "distribuida", rotulo: "Distribuídos" },
  { chave: "em_andamento", rotulo: "Em andamento" },
  { chave: "concluida", rotulo: "Concluídos" },
  { chave: "cancelada", rotulo: "Cancelados" },
  { chave: "todas", rotulo: "Todos" },
];

function Fila() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const [aba, setAba] = useState<StatusOrdem | "todas">("pendente_definicao");
  const [busca, setBusca] = useState("");
  const [locadoraId, setLocadoraId] = useState("todas");
  const [selecao, setSelecao] = useState<string[]>([]);
  const [modal, setModal] = useState(false);
  const [principalId, setPrincipalId] = useState("");
  const [auxiliarId, setAuxiliarId] = useState("");
  const [valores, setValores] = useState({ cobranca: 0, principal: 0, auxiliar: 0, km: 0 });

  function fecharModal() {
    setModal(false);
    setPrincipalId("");
    setAuxiliarId("");
    setValores({ cobranca: 0, principal: 0, auxiliar: 0, km: 0 });
  }

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return banco.ordens
      .filter((o) => (aba === "todas" ? true : o.status === aba))
      .filter((o) => (locadoraId === "todas" ? true : o.locadoraId === locadoraId))
      .filter((o) =>
        termo
          ? [o.placa, o.modelo, o.cidade, o.codigo].some((c) => c.toLowerCase().includes(termo))
          : true,
      )
      .sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
  }, [banco.ordens, aba, busca, locadoraId]);

  const contagem = (chave: StatusOrdem | "todas") =>
    chave === "todas" ? banco.ordens.length : banco.ordens.filter((o) => o.status === chave).length;

  async function distribuir() {
    const principal = banco.agentes.find((a) => a.id === principalId);
    const auxiliar = banco.agentes.find((a) => a.id === auxiliarId);
    const alvos = banco.ordens.filter((o) => selecao.includes(o.id));
    const ids = alvos.map((o) => o.id);
    try {
      await OrdensService.distribuir(alvos, {
        principalId,
        auxiliarId: auxiliarId || undefined,
        valorCobranca: valores.cobranca || undefined,
        valorPrincipal: valores.principal || undefined,
        valorAuxiliar: valores.auxiliar || undefined,
        quantidadeKm: valores.km || undefined,
      });
      await Promise.all(
        ids.map((id) =>
          OrdensService.registrarHistorico(
            id,
            usuario?.nome ?? "Operador",
            "Ordem distribuída",
            auxiliar
              ? `Principal ${principal?.nome} · Auxiliar ${auxiliar.nome}`
              : `Agente ${principal?.nome}`,
          ),
        ),
      );
      await sincronizar("ordens");
      setSelecao([]);
      fecharModal();
      toast.success(`${ids.length} ordem(ns) enviada(s) para ${principal?.nome}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const todasMarcadas = lista.length > 0 && selecao.length === lista.length;

  return (
    <Pagina
      titulo="Fila de recolhimentos"
      descricao="Selecione ordens e direcione ao agente responsável."
      acoes={
        <Botao variante="solido" disabled={selecao.length === 0} onClick={() => setModal(true)}>
          <UserPlus className="size-4" /> Distribuir {selecao.length > 0 && `(${selecao.length})`}
        </Botao>
      }
    >
      <Abas
        id="fila"
        valor={aba}
        aoTrocar={(v) => {
          setAba(v);
          setSelecao([]);
        }}
        itens={ABAS.map((a) => ({ valor: a.chave, rotulo: a.rotulo, contador: contagem(a.chave) }))}
      />

      <BarraFiltros>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Placa, modelo, cidade ou código"
          aria-label="Buscar ordens"
          className="campo w-full sm:w-64"
        />
        <select
          value={locadoraId}
          onChange={(e) => setLocadoraId(e.target.value)}
          aria-label="Filtrar por locadora"
          className="campo w-full sm:w-auto"
        >
          <option value="todas">Todas as locadoras</option>
          {banco.locadoras.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {lista.length} ordem(ns)
        </span>
        {selecao.length > 0 && (
          <Botao variante="fantasma" tamanho="sm" onClick={() => setSelecao([])}>
            limpar seleção
          </Botao>
        )}
      </BarraFiltros>

      <div className="mt-4">
        {lista.length === 0 ? (
          <Vazio
            icone={ClipboardList}
            titulo="Nenhuma ordem nesta visão"
            texto="Ajuste os filtros ou aguarde novas importações das locadoras."
            acao={
              <Botao
                variante="linha"
                tamanho="sm"
                onClick={() => {
                  setAba("todas");
                  setBusca("");
                  setLocadoraId("todas");
                }}
              >
                Ver todas as ordens
              </Botao>
            }
          />
        ) : (
          <Tabela minLargura={920}>
            <CabecalhoTabela
              extra={
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={(e) => setSelecao(e.target.checked ? lista.map((o) => o.id) : [])}
                    aria-label="Selecionar todas"
                  />
                </th>
              }
              colunas={[
                "Placa",
                "Motocicleta",
                "Locadora",
                "Cidade",
                "Serviço",
                "Prioridade",
                "Agente",
                "Status",
                { rotulo: "Total", alinhar: "direita" },
                { rotulo: "", largura: "48px" },
              ]}
            />
            <CorpoTabela>
              {lista.map((o) => {
                const loc = banco.locadoras.find((l) => l.id === o.locadoraId);
                const ag = banco.agentes.find((a) => a.id === o.agenteId);
                const marcada = selecao.includes(o.id);
                return (
                  <LinhaTabela key={o.id} ativa={marcada}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={(e) =>
                          setSelecao((s) =>
                            e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id),
                          )
                        }
                        aria-label={`Selecionar ${o.placa}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to="/ordens/$id"
                        params={{ id: o.id }}
                        className="font-mono text-[13px] text-primary hover:underline"
                      >
                        {o.placa}
                      </Link>
                      <p className="font-mono text-[10px] text-muted-foreground">{o.codigo}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {o.marca} {o.modelo}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{loc?.nome}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{o.cidade}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {nomeServico(banco, o)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Prioridade_ valor={o.prioridade} />
                    </td>
                    <td className="px-3 py-2.5 text-[12px]">
                      {ag?.nome ?? <span className="text-muted-foreground">—</span>}
                      {o.agenteAuxiliarId && (
                        <span className="block text-[11px] text-muted-foreground">
                          aux. {banco.agentes.find((x) => x.id === o.agenteAuxiliarId)?.nome ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Status valor={o.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {valorReceber(banco, o) > 0 ? moedaBR(valorReceber(banco, o)) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <AcoesOrdem ordem={o} className="inline-block" />
                    </td>
                  </LinhaTabela>
                );
              })}
            </CorpoTabela>
          </Tabela>
        )}
      </div>

      <Modal
        aberto={modal}
        aoFechar={fecharModal}
        titulo="Distribuir ordens"
        descricao={`${selecao.length} ordem(ns) selecionada(s) · a dupla de campo é obrigatória`}
      >
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {[
            {
              papel: "principal" as const,
              rotulo: "Agente principal",
              valor: principalId,
              set: setPrincipalId,
            },
            {
              papel: "auxiliar" as const,
              rotulo: "Agente auxiliar",
              valor: auxiliarId,
              set: setAuxiliarId,
            },
          ].map((campo) => (
            <div key={campo.papel} className="bg-surface px-4 py-3">
              <p className="label-caps">{campo.rotulo}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {campo.papel === "principal"
                  ? "Executa o recolhimento pelo aplicativo."
                  : "Entra no financeiro e no histórico da ordem."}
              </p>
              <ul className="mt-2 max-h-52 divide-y divide-border overflow-y-auto border border-border">
                {banco.agentes
                  .filter((a) => a.ativo)
                  .map((a) => {
                    const indisponivel =
                      campo.papel === "principal" ? a.id === auxiliarId : a.id === principalId;
                    const carga = banco.ordens.filter(
                      (o) =>
                        (o.agenteId === a.id || o.agenteAuxiliarId === a.id) &&
                        (o.status === "distribuida" || o.status === "em_andamento"),
                    ).length;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          disabled={indisponivel}
                          onClick={() => campo.set(campo.valor === a.id ? "" : a.id)}
                          className={cn(
                            "press grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-raised disabled:pointer-events-none disabled:opacity-35",
                            campo.valor === a.id && "bg-primary/10",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              estadoAgente(banco, a) === "disponivel"
                                ? "bg-success"
                                : "bg-border-strong",
                            )}
                          />

                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-foreground">
                              {a.nome}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {a.cidade} · {carga} em aberto ·{" "}
                              {ROTULO_ESTADO_AGENTE[estadoAgente(banco, a)].toLowerCase()} ·{" "}
                              {desde(a.vistoEm)}
                            </span>
                          </span>
                          <Check
                            className={cn(
                              "size-3.5 shrink-0 text-primary transition-opacity",
                              campo.valor === a.id ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-px grid gap-px bg-border sm:grid-cols-2">
          <CampoMoeda
            rotulo="Cobrança da locadora (opcional)"
            valor={valores.cobranca}
            aoAlterar={(v) => setValores((s) => ({ ...s, cobranca: v }))}
          />
          <label className="block bg-surface px-4 py-3">
            <span className="label-caps">Quilometragem (viagem especial)</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={valores.km ? String(valores.km) : ""}
              onChange={(e) =>
                setValores((s) => ({ ...s, km: Number(e.target.value.replace(/\D/g, "")) }))
              }
              className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-right font-mono text-[13px] tabular-nums outline-none transition-colors focus:border-primary"
            />
          </label>
          <CampoMoeda
            rotulo="Repasse do principal (opcional)"
            valor={valores.principal}
            aoAlterar={(v) => setValores((s) => ({ ...s, principal: v }))}
          />
          <CampoMoeda
            rotulo="Repasse do auxiliar (opcional)"
            valor={valores.auxiliar}
            aoAlterar={(v) => setValores((s) => ({ ...s, auxiliar: v }))}
            disabled={!auxiliarId}
          />
        </div>

        <p className="mt-3 text-[12px] text-muted-foreground">
          Valores em branco seguem a tabela de remuneração. O que for digitado aqui vale só para
          estas ordens e não altera nenhuma tabela.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="linha" onClick={fecharModal}>
            Cancelar
          </Botao>
          <Botao variante="solido" disabled={!principalId} onClick={() => void distribuir()}>
            <UserPlus className="size-4" /> Distribuir
          </Botao>
        </div>
      </Modal>

      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <ExternalLink className="size-3" /> O link de rastreamento da moto fica na ficha de cada
        ordem.
      </p>
    </Pagina>
  );
}
