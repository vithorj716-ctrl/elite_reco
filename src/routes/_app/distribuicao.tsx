/**
 * Central de distribuição automática.
 *
 * Cada motocicleta cadastrada gera automaticamente vistoria e recolhimento,
 * com agente sorteado e valores congelados da tabela vigente. Aqui a central
 * acompanha o sorteio, corrige rota (redistribuir, trocar serviço ou valor) e
 * lê o histórico permanente de tudo que aconteceu.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Radio, RefreshCw, ShieldCheck, Shuffle, Tag, Wallet, XCircle } from "lucide-react";
import {
  Abas,
  BarraFiltros,
  Botao,
  CabecalhoTabela,
  CorpoTabela,
  LinhaTabela,
  Metrica,
  Modal,
  Pagina,
  Selo,
  Tabela,
  Vazio,
} from "@/components/app/ui";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { DefinicaoOperacao } from "@/components/negocio/definicao-operacao";
import { SeloEstado, useAgora } from "@/components/negocio/disponibilidade";
import {
  ROTULO_ESTADO_AGENTE,
  desde,
  estadoAgente,
  operacaoAtual,
  presencaRecente,
} from "@/domain/services/presenca";
import { DistribuicaoService } from "@/services/distribuicao.service";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useBanco, useSincronizar } from "@/lib/sessao";
import { dinheiroExato } from "@/domain/services/financeiro";
import {
  ROTULO_ORIGEM_DISTRIBUICAO,
  ROTULO_STATUS_DISTRIBUICAO,
  ROTULO_TIPO_DISTRIBUICAO,
} from "@/domain/types";
import type { Distribuicao, StatusDistribuicao } from "@/domain/types";

export const Route = createFileRoute("/_app/distribuicao")({
  head: () => ({
    meta: [
      { title: "Distribuição automática — Recolhe" },
      {
        name: "description",
        content:
          "Sorteio automático de vistorias e recolhimentos entre os agentes, com histórico e controle total da central.",
      },
      { property: "og:title", content: "Distribuição automática — Recolhe" },
      {
        property: "og:description",
        content: "Acompanhe o sorteio, o aceite dos agentes e corrija serviço, valor ou responsável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina_,
});

type Aba = "definicao" | "abertas" | "aceitas" | "recusadas" | "concluidas" | "todas";

const ABAS: Array<{ chave: Aba; rotulo: string; status: StatusDistribuicao[] }> = [
  { chave: "definicao", rotulo: "Aguardando definição", status: ["aguardando_definicao"] },
  {
    chave: "abertas",
    rotulo: "Aguardando aceite",
    status: ["aguardando_distribuicao", "distribuida", "notificada"],
  },
  { chave: "aceitas", rotulo: "Aceitas", status: ["aceita", "em_execucao"] },
  { chave: "recusadas", rotulo: "Recusadas", status: ["recusada", "redistribuida"] },
  { chave: "concluidas", rotulo: "Concluídas", status: ["concluida"] },
  { chave: "todas", rotulo: "Todas", status: [] },
];

const TOM: Record<StatusDistribuicao, "neutro" | "primario" | "sucesso" | "alerta" | "perigo" | "info"> = {
  aguardando_definicao: "alerta",
  aguardando_distribuicao: "alerta",
  distribuida: "info",
  notificada: "info",
  aceita: "primario",
  em_execucao: "primario",
  recusada: "perigo",
  concluida: "sucesso",
  cancelada: "perigo",
  redistribuida: "alerta",
};

function Pagina_() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [aba, setAba] = useState<Aba>("abertas");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [agenteId, setAgenteId] = useState("todos");
  const [detalhe, setDetalhe] = useState<Distribuicao | null>(null);
  const [definir, setDefinir] = useState<Distribuicao | null>(null);
  const [acao, setAcao] = useState<
    { tipo: "redistribuir" | "servico" | "valor" | "cancelar"; alvo: Distribuicao } | null
  >(null);

  const nomeAgente = (id?: string) => banco.agentes.find((a) => a.id === id)?.nome ?? "—";
  const placa = (d: Distribuicao) => banco.motos.find((m) => m.id === d.motoId)?.placa ?? "—";
  const nomeLocadora = (id: string) => banco.locadoras.find((l) => l.id === id)?.nome ?? "—";

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtroStatus = ABAS.find((a) => a.chave === aba)?.status ?? [];
    return banco.distribuicoes
      .filter((d) => (filtroStatus.length === 0 ? true : filtroStatus.includes(d.status)))
      .filter((d) => (tipo === "todos" ? true : d.tipo === tipo))
      .filter((d) => (agenteId === "todos" ? true : d.agenteId === agenteId))
      .filter((d) =>
        termo
          ? [placa(d), d.servicoNome, nomeAgente(d.agenteId), nomeLocadora(d.locadoraId)]
              .join(" ")
              .toLowerCase()
              .includes(termo)
          : true,
      );
  }, [banco.distribuicoes, aba, tipo, agenteId, busca]);

  const contar = (chave: Aba) => {
    const s = ABAS.find((a) => a.chave === chave)?.status ?? [];
    return s.length === 0
      ? banco.distribuicoes.length
      : banco.distribuicoes.filter((d) => s.includes(d.status)).length;
  };

  const aguardando = contar("abertas");
  const aDefinir = contar("definicao");
  const recusadas = banco.distribuicoes.filter((d) => d.status === "recusada").length;
  const aReceber = banco.distribuicoes
    .filter(
      (d) =>
        d.status !== "cancelada" && d.status !== "redistribuida" && d.status !== "aguardando_definicao",
    )
    .reduce((t, d) => t + d.valorCobranca, 0);

  return (
    <Pagina
      titulo="Distribuição automática"
      descricao="Todo recolhimento lançado passa pela definição de valores do administrador antes de chegar aos agentes."
    >
      <div className="mb-4 grid gap-px bg-border sm:grid-cols-4">
        <Metrica rotulo="Aguardando definição" valor={String(aDefinir)} />
        <Metrica rotulo="Aguardando aceite" valor={String(aguardando)} />
        <Metrica rotulo="Recusas em aberto" valor={String(recusadas)} />
        <Metrica rotulo="Cobrança liberada" valor={dinheiroExato(aReceber)} />
      </div>

      <PresencaEquipe />

      <Abas
        id="distribuicao"
        valor={aba}
        aoTrocar={setAba}
        itens={ABAS.map((a) => ({ valor: a.chave, rotulo: a.rotulo, contador: contar(a.chave) }))}
      />

      <BarraFiltros>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Placa, serviço, agente ou locadora"
          aria-label="Buscar distribuições"
          className="campo w-full sm:w-72"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          aria-label="Filtrar por tipo de operação"
          className="campo w-full sm:w-auto"
        >
          <option value="todos">Vistorias e recolhimentos</option>
          <option value="vistoria">Somente vistorias</option>
          <option value="recolhimento">Somente recolhimentos</option>
        </select>
        <select
          value={agenteId}
          onChange={(e) => setAgenteId(e.target.value)}
          aria-label="Filtrar por agente"
          className="campo w-full sm:w-auto"
        >
          <option value="todos">Todos os agentes</option>
          {banco.agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {lista.length} registro(s)
        </span>
      </BarraFiltros>

      <div className="mt-4">
        {lista.length === 0 ? (
          <Vazio
           
            titulo="Nenhuma distribuição nesta visão"
            texto="Assim que uma motocicleta for cadastrada, o sistema cria e distribui os serviços automaticamente."
          />
        ) : (
          <Tabela minLargura={1040}>
            <CabecalhoTabela
              colunas={[
                "Operação",
                "Moto e locadora",
                "Serviço",
                "Agente",
                { rotulo: "Cobrança", alinhar: "direita" },
                { rotulo: "Repasse", alinhar: "direita" },
                "Situação",
                { rotulo: "Ações", alinhar: "direita" },
              ]}
            />
            <CorpoTabela>
              {lista.map((d) => (
                <LinhaTabela key={d.id}>
                  <td className="px-3 py-2.5">
                    <span className="text-[13px] text-foreground">
                      {ROTULO_TIPO_DISTRIBUICAO[d.tipo]}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {ROTULO_ORIGEM_DISTRIBUICAO[d.origem]}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[13px] text-foreground">{placa(d)}</span>
                    <p className="text-[11px] text-muted-foreground">{nomeLocadora(d.locadoraId)}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-foreground">{d.servicoNome}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[13px] text-foreground">{nomeAgente(d.agenteId)}</span>
                    {d.agenteAuxiliarId && (
                      <p className="text-[11px] text-muted-foreground">
                        Auxiliar: {nomeAgente(d.agenteAuxiliarId)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] tabular-nums">
                    {dinheiroExato(d.valorCobranca)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] tabular-nums">
                    {dinheiroExato(d.valorPagamento)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Selo tom={TOM[d.status]}>{ROTULO_STATUS_DISTRIBUICAO[d.status]}</Selo>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Botao variante="fantasma" tamanho="sm" onClick={() => setDetalhe(d)}>
                        <History className="size-4" /> Histórico
                      </Botao>
                      {d.status === "aguardando_definicao" ? (
                        <Botao variante="solido" tamanho="sm" onClick={() => setDefinir(d)}>
                          <ShieldCheck className="size-4" /> Definir e liberar
                        </Botao>
                      ) : (
                        <>
                          <Botao
                            variante="fantasma"
                            tamanho="sm"
                            onClick={() => setAcao({ tipo: "redistribuir", alvo: d })}
                          >
                            <Shuffle className="size-4" /> Redistribuir
                          </Botao>
                          <Botao
                            variante="fantasma"
                            tamanho="sm"
                            onClick={() => setAcao({ tipo: "servico", alvo: d })}
                          >
                            <Tag className="size-4" /> Serviço
                          </Botao>
                          <Botao
                            variante="fantasma"
                            tamanho="sm"
                            onClick={() => setAcao({ tipo: "valor", alvo: d })}
                          >
                            <Wallet className="size-4" /> Valor
                          </Botao>
                        </>
                      )}
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => setAcao({ tipo: "cancelar", alvo: d })}
                      >
                        <XCircle className="size-4" /> Cancelar
                      </Botao>
                    </div>
                  </td>
                </LinhaTabela>
              ))}
            </CorpoTabela>
          </Tabela>
        )}
      </div>

      <Historico
        distribuicao={detalhe}
        aoFechar={() => setDetalhe(null)}
        aoAtualizar={() => sincronizar()}
      />
      <AcaoAdministrativa
        acao={acao}
        aoFechar={() => setAcao(null)}
        aoConcluir={() => {
          setAcao(null);
          sincronizar();
        }}
      />
      <DefinicaoOperacao
        distribuicao={definir}
        aoFechar={() => setDefinir(null)}
        aoConcluir={() => {
          setDefinir(null);
          sincronizar();
        }}
      />
    </Pagina>
  );
}

function Historico({
  distribuicao,
  aoFechar,
  aoAtualizar,
}: {
  distribuicao: Distribuicao | null;
  aoFechar: () => void;
  aoAtualizar: () => void;
}) {
  const banco = useBanco();
  const [ocupado, setOcupado] = useState(false);
  const eventos = banco.eventosDistribuicao.filter((e) => e.distribuicaoId === distribuicao?.id);

  async function reenviar() {
    if (!distribuicao) return;
    setOcupado(true);
    try {
      await DistribuicaoService.reenviarNotificacao(distribuicao.id);
      aoAtualizar();
      toast.success("Aviso reenviado ao agente.");
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
      titulo="Histórico da distribuição"
      descricao="Registro permanente: nada é apagado, toda alteração fica rastreada."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Fechar
          </Botao>
          <Botao variante="linha" carregando={ocupado} onClick={reenviar}>
            <RefreshCw className="size-4" /> Reenviar aviso
          </Botao>
        </>
      }
    >
      {distribuicao && (
        <div className="space-y-4">
          <div className="border border-border bg-surface p-3">
            <p className="label-caps">Regra do sorteio</p>
            <p className="mt-1 text-[13px] text-foreground">{distribuicao.regra || "—"}</p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Elegíveis: {distribuicao.elegiveis.map((a) => a.nome).join(", ") || "—"}
            </p>
            {distribuicao.descartados.length > 0 && (
              <p className="text-[12px] text-muted-foreground">
                Descartados: {distribuicao.descartados.map((a) => a.nome).join(", ")}
              </p>
            )}
            {distribuicao.motoId && (
              <Link
                to="/moto/$id"
                params={{ id: distribuicao.motoId }}
                className="mt-2 inline-block text-[12px] text-primary underline-offset-2 hover:underline"
              >
                Abrir ficha da motocicleta
              </Link>
            )}
          </div>

          <ol className="space-y-px bg-border">
            {eventos.length === 0 && (
              <li className="bg-surface p-3 text-[13px] text-muted-foreground">
                Nenhum evento registrado.
              </li>
            )}
            {eventos.map((e) => (
              <li key={e.id} className="bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-foreground">{e.acao}</span>
                  <Selo tom={e.automatico ? "info" : "primario"}>
                    {e.automatico ? "Automático" : e.quemNome}
                  </Selo>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {new Date(e.quando).toLocaleString("pt-BR")}
                  </span>
                </div>
                {e.detalhe && (
                  <p className="mt-1 text-[12px] text-muted-foreground">{e.detalhe}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function AcaoAdministrativa({
  acao,
  aoFechar,
  aoConcluir,
}: {
  acao: { tipo: "redistribuir" | "servico" | "valor" | "cancelar"; alvo: Distribuicao } | null;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const banco = useBanco();
  const [motivo, setMotivo] = useState("");
  const [agente, setAgente] = useState("");
  const [servico, setServico] = useState("");
  const [cobranca, setCobranca] = useState(0);
  const [pagamento, setPagamento] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  const titulos = {
    redistribuir: "Redistribuir operação",
    servico: "Alterar serviço",
    valor: "Alterar valores",
    cancelar: "Cancelar distribuição",
  } as const;

  async function confirmar() {
    if (!acao) return;
    setOcupado(true);
    try {
      if (acao.tipo === "redistribuir")
        await DistribuicaoService.redistribuir(acao.alvo.id, agente || null, motivo);
      if (acao.tipo === "servico")
        await DistribuicaoService.alterarServico(acao.alvo.id, servico, motivo);
      if (acao.tipo === "valor")
        await DistribuicaoService.alterarValor(acao.alvo.id, cobranca, pagamento, motivo);
      if (acao.tipo === "cancelar") await DistribuicaoService.cancelar(acao.alvo.id, motivo);
      setMotivo("");
      setAgente("");
      setServico("");
      aoConcluir();
      toast.success("Alteração registrada no histórico da distribuição.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      aberto={!!acao}
      aoFechar={aoFechar}
      titulo={acao ? titulos[acao.tipo] : ""}
      descricao="Toda alteração exige motivo e fica registrada de forma permanente."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="solido" carregando={ocupado} onClick={confirmar}>
            Confirmar
          </Botao>
        </>
      }
    >
      {acao && (
        <div className="space-y-3">
          {acao.tipo === "redistribuir" && (
            <label className="block">
              <span className="label-caps">Agente (deixe vazio para novo sorteio)</span>
              <select
                value={agente}
                onChange={(e) => setAgente(e.target.value)}
                className="campo mt-1 w-full"
              >
                <option value="">Sortear automaticamente</option>
                {banco.agentes
                  .filter((a) => a.ativo && a.id !== acao.alvo.agenteId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} — {a.cidade}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {acao.tipo === "servico" && (
            <label className="block">
              <span className="label-caps">Novo serviço</span>
              <select
                value={servico}
                onChange={(e) => setServico(e.target.value)}
                className="campo mt-1 w-full"
              >
                <option value="">Escolha o serviço</option>
                {banco.servicos
                  .filter((s) => s.ativo)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {acao.tipo === "valor" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoMoeda rotulo="Cobrança da locadora" valor={cobranca} aoAlterar={setCobranca} />
              <CampoMoeda rotulo="Repasse do agente" valor={pagamento} aoAlterar={setPagamento} />
            </div>
          )}

          <label className="block">
            <span className="label-caps">Motivo</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="campo mt-1 w-full"
              placeholder="Explique a razão desta alteração"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}

/**
 * Presença da equipe.
 *
 * Duas colunas independentes de propósito: DISPONIBILIDADE é a decisão do
 * agente (só ele muda) e CONEXÃO é a última vez que o aparelho falou com o
 * servidor. Falta de comunicação nunca transforma o agente em offline.
 */
function PresencaEquipe() {
  const banco = useBanco();
  const agora = useAgora(10_000);

  // Serviços recusados pelo agente: a ausência de registro significa aceitar.
  const { data: recusas = [] } = useQuery({
    queryKey: ["agenteServicosCentral"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agente_servicos")
        .select("agente_id, servico_id, aceita");
      return (data ?? []) as Array<{ agente_id: string; servico_id: string; aceita: boolean }>;
    },
    refetchInterval: 60_000,
  });

  const ativos = useMemo(() => banco.servicos.filter((s) => s.ativo), [banco.servicos]);

  const aceitos = (agenteId: string) => {
    const negados = new Set(
      recusas.filter((r) => r.agente_id === agenteId && !r.aceita).map((r) => r.servico_id),
    );
    const nomes = ativos.filter((s) => !negados.has(s.id)).map((s) => s.nome);
    if (nomes.length === 0) return "nenhum serviço aceito";
    if (nomes.length === ativos.length) return "todos os serviços";
    return nomes.join(", ");
  };

  const linhas = banco.agentes
    .filter((a) => a.ativo)
    .map((a) => ({ agente: a, estado: estadoAgente(banco, a, agora) }))
    .sort((x, y) => (x.estado === "disponivel" ? -1 : y.estado === "disponivel" ? 1 : 0));

  if (linhas.length === 0) return null;

  return (
    <section className="mb-4 border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Radio className="size-3.5 text-primary" aria-hidden />
        <p className="label-caps">Presença da equipe</p>
        <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {linhas.filter((l) => l.estado === "disponivel").length} disponível(is) agora
        </p>
      </div>
      <Tabela minLargura={960}>
        <CabecalhoTabela
          colunas={[
            "Agente",
            "Disponibilidade",
            "Conexão",
            "Última comunicação",
            "Serviços aceitos",
            "Operação atual",
          ]}
        />
        <CorpoTabela>
          {linhas.map(({ agente, estado }) => {
            const conectado = presencaRecente(agente.vistoEm, agora);
            return (
              <LinhaTabela key={agente.id}>
                <td className="px-4 py-2.5 text-[13px] text-foreground">{agente.nome}</td>
                <td className="px-4 py-2.5">
                  <SeloEstado estado={estado} />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {estado === "disponivel"
                      ? "pode receber novas ordens"
                      : ROTULO_ESTADO_AGENTE[estado].toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[12px]">
                  {conectado ? (
                    <span className="text-success">Conectado</span>
                  ) : (
                    <span className="text-warning">Sem comunicação recente</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {desde(agente.vistoEm, agora)}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                  {aceitos(agente.id)}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                  {operacaoAtual(banco, agente.id)}
                </td>
              </LinhaTabela>
            );
          })}
        </CorpoTabela>
      </Tabela>
    </section>
  );
}

