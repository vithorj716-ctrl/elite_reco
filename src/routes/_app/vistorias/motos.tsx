/**
 * Gestão de motos — cadastro único e global, usado por vistorias e recolhimentos.
 * Aqui a moto nasce, é editada, inativada e (quando nunca foi usada) excluída.
 * O semáforo do ciclo de 40 dias continua na própria linha.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bike, Search } from "lucide-react";
import {
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
import { useConfirmacao } from "@/components/app/confirmar";
import { AreaTexto, BlocoCampos, Entrada, Grade, Selecao } from "@/components/negocio/formulario";
import { BlocoRastreador, hostValido, normalizarPin } from "@/components/negocio/rastreador";
import { SeletorLocadora } from "@/components/negocio/seletor-locadora";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { avisarErros, limparErro } from "@/lib/validacao";
import { MotosService, type NovaMoto } from "@/services/motos.service";
import { VistoriasService } from "@/services/vistorias.service";
import {
  diasRestantes,
  LINHA_PRAZO,
  ROTULO_PRAZO,
  statusPrazo,
  TOM_PRAZO,
} from "@/domain/services/vistorias";
import {
  ROTULO_SITUACAO_MOTO,
  ROTULO_STATUS_VISTORIA,
  type Moto,
  type SituacaoMoto,
  type StatusPrazo,
} from "@/domain/types";

export const Route = createFileRoute("/_app/vistorias/motos")({
  head: () => ({
    meta: [
      { title: "Motos e ciclo de vistoria — Recolhe" },
      {
        name: "description",
        content:
          "Cadastro de motos por locadora com prazo da próxima vistoria e alerta de vencimento.",
      },
      { property: "og:title", content: "Motos e ciclo de vistoria — Recolhe" },
      {
        property: "og:description",
        content: "Frota das locadoras com semáforo do ciclo obrigatório de 40 dias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaMotos,
});

const VAZIA: NovaMoto = {
  locadoraId: "",
  placa: "",
  marca: "",
  modelo: "",
  ano: "",
  cor: "",
  chassi: "",
  observacoes: "",
  situacao: "ativa",
  host: "",
  pin: "",
};

const data = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

/** Placa Mercosul (ABC1D23) ou padrão antigo (ABC1234). */
const normalizarPlaca = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
const placaValida = (v: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v);
const anoValido = (v: string) => !v.trim() || (/^\d{4}$/.test(v.trim()) && Number(v) >= 1950);

function TelaMotos() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const daLocadora = usuario?.papel === "cliente";
  const { pedir, dialogo } = useConfirmacao();

  const [form, setForm] = useState<NovaMoto>(VAZIA);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [ficha, setFicha] = useState<Moto | null>(null);
  const [busca, setBusca] = useState("");
  const [prazo, setPrazo] = useState<"todos" | StatusPrazo>("todos");
  const [situacao, setSituacao] = useState<"todas" | SituacaoMoto>("todas");
  const [filtroLocadora, setFiltroLocadora] = useState("");

  const nomeLocadora = (id: string) => banco.locadoras.find((l) => l.id === id)?.nome ?? "—";

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return banco.motos
      .filter((m) => {
        if (prazo !== "todos" && statusPrazo(m) !== prazo) return false;
        if (situacao !== "todas" && m.situacao !== situacao) return false;
        if (filtroLocadora && m.locadoraId !== filtroLocadora) return false;
        if (!termo) return true;
        return (
          m.placa.toLowerCase().includes(termo) ||
          m.marca.toLowerCase().includes(termo) ||
          m.modelo.toLowerCase().includes(termo) ||
          nomeLocadora(m.locadoraId).toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => (diasRestantes(a) ?? 9999) - (diasRestantes(b) ?? 9999));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banco.motos, banco.locadoras, busca, prazo, situacao, filtroLocadora]);

  const contagem = useMemo(() => {
    const ativas = banco.motos.filter((m) => m.situacao === "ativa");
    return {
      total: ativas.length,
      vencidas: ativas.filter((m) => statusPrazo(m) === "vencida").length,
      proximas: ativas.filter((m) => statusPrazo(m) === "proxima").length,
      inativas: banco.motos.length - ativas.length,
    };
  }, [banco.motos]);

  const abrirNova = () => {
    setEditando(null);
    setErros({});
    setForm({ ...VAZIA, locadoraId: daLocadora ? (usuario?.locadoraId ?? "") : "" });
    setAberto(true);
  };

  const abrirEdicao = (m: Moto) => {
    setEditando(m.id);
    setErros({});
    setForm({
      locadoraId: m.locadoraId,
      placa: m.placa,
      marca: m.marca,
      modelo: m.modelo,
      ano: m.ano,
      cor: m.cor,
      chassi: m.chassi,
      observacoes: m.observacoes,
      situacao: m.situacao,
      host: m.host,
      pin: m.pin,
    });
    setAberto(true);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.locadoraId) e["locadoraId"] = "Escolha a locadora dona da moto.";
    if (!form.placa.trim()) e["placa"] = "A placa é obrigatória.";
    else if (!placaValida(normalizarPlaca(form.placa)))
      e["placa"] = "Use o padrão Mercosul (ABC1D23) ou o antigo (ABC1234).";
    if (!anoValido(form.ano ?? "")) e["ano"] = "Informe um ano com 4 dígitos.";
    if (!hostValido(form.host ?? "")) e["host"] = "Informe uma URL válida começando com https://";
    setErros(e);
    // Aviso nomeando cada pendência + rolagem até o campo iluminado no modal.
    return avisarErros(e);
  };

  const salvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const placa = normalizarPlaca(form.placa);
      const duplicada = await MotosService.placaDuplicada(
        form.locadoraId,
        placa,
        editando ?? undefined,
      );
      if (duplicada) {
        setErros({ placa: "Moto já cadastrada." });
        toast.error("Moto já cadastrada.");
        return;
      }
      const limpo: NovaMoto = {
        ...form,
        placa,
        marca: (form.marca ?? "").trim(),
        modelo: (form.modelo ?? "").trim(),
        ano: (form.ano ?? "").trim(),
        cor: (form.cor ?? "").trim(),
        chassi: (form.chassi ?? "").trim().toUpperCase(),
        observacoes: (form.observacoes ?? "").trim(),
        host: (form.host ?? "").trim(),
        pin: (form.pin ?? "").trim(),
      };
      if (editando) await MotosService.atualizar(editando, limpo);
      else await MotosService.criar(limpo);
      toast.success(editando ? "Moto atualizada." : "Moto cadastrada.");
      setAberto(false);
      sincronizar(["motos"]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const inativar = async (m: Moto) => {
    const ok = await pedir({
      titulo: "Inativar moto?",
      texto: `${m.placa} deixa de gerar alerta de vistoria, mas todo o histórico é preservado.`,
      confirmar: "Inativar moto",
      destrutivo: false,
    });
    if (!ok) return;
    try {
      await MotosService.alternarSituacao(m.id, "inativa");
      toast.success("Moto inativada.");
      sincronizar(["motos"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const excluir = async (m: Moto) => {
    let vinculos;
    try {
      vinculos = await MotosService.historico(m.id, m.placa);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    if (vinculos.possui) {
      const inativarAgora = await pedir({
        titulo: "Esta moto possui registros vinculados",
        texto: "Ela não pode ser apagada definitivamente. Inative para preservar o histórico.",
        confirmar: "Inativar moto",
        destrutivo: false,
      });
      if (inativarAgora) await inativar(m);
      return;
    }

    const ok = await pedir({
      titulo: "Excluir moto?",
      texto: "Esta ação removerá a moto do cadastro.",
      confirmar: "Excluir moto",
    });
    if (!ok) return;
    try {
      await MotosService.excluir(m.id, m.placa);
      toast.success("Moto excluída.");
      setFicha(null);
      sincronizar(["motos"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reativar = async (m: Moto) => {
    try {
      await MotosService.alternarSituacao(m.id, "ativa");
      toast.success("Moto reativada.");
      sincronizar(["motos"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const solicitar = async (motoId: string, locadoraId: string) => {
    try {
      await VistoriasService.solicitar({
        motoId,
        locadoraId,
        origem: daLocadora ? "locadora" : "central",
      });
      toast.success("Vistoria solicitada. A central vai distribuir para um agente.");
      sincronizar(["vistorias", "notificacoes"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const vistoriasDa = (m: Moto) =>
    banco.vistorias
      .filter((v) => v.motoId === m.id)
      .sort((a, b) => b.solicitadaEm.localeCompare(a.solicitadaEm));
  const ordensDa = (m: Moto) => banco.ordens.filter((o) => o.placa === m.placa);

  return (
    <Pagina
      titulo="Motos"
      descricao="Cadastro único da frota. Cada moto precisa de vistoria a cada 40 dias e é usada como está em vistorias e recolhimentos."
      acoes={<Botao onClick={abrirNova}>Cadastrar moto</Botao>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Motos ativas" valor={contagem.total} />
        <Metrica rotulo="Vencidas" valor={contagem.vencidas} destaque />
        <Metrica rotulo="Próximas" valor={contagem.proximas} nota="7 dias ou menos" />
        <Metrica rotulo="Inativas" valor={contagem.inativas} />
      </div>

      <BarraFiltros>
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Entrada
            rotulo="Buscar"
            placeholder="Placa, marca, modelo ou locadora"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Selecao
          rotulo="Situação"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value as "todas" | SituacaoMoto)}
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "ativa", rotulo: "Ativas" },
            { valor: "inativa", rotulo: "Inativas" },
          ]}
        />
        <Selecao
          rotulo="Prazo"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value as "todos" | StatusPrazo)}
          opcoes={[
            { valor: "todos", rotulo: "Todos os prazos" },
            { valor: "vencida", rotulo: "Vencidas" },
            { valor: "proxima", rotulo: "Próximas do vencimento" },
            { valor: "em_dia", rotulo: "Em dia" },
            { valor: "sem_vistoria", rotulo: "Sem vistoria" },
          ]}
        />
        {!daLocadora && (
          <Selecao
            rotulo="Locadora"
            value={filtroLocadora}
            onChange={(e) => setFiltroLocadora(e.target.value)}
            opcoes={[
              { valor: "", rotulo: "Todas as locadoras" },
              ...banco.locadoras.map((l) => ({ valor: l.id, rotulo: l.nome })),
            ]}
          />
        )}
      </BarraFiltros>

      {lista.length === 0 ? (
        <div className="mt-4">
          <Vazio
            icone={Bike}
            titulo="Nenhuma moto encontrada"
            texto="Cadastre as motos da locadora para iniciar o ciclo de vistorias."
            acao={<Botao onClick={abrirNova}>Cadastrar moto</Botao>}
          />
        </div>
      ) : (
        <div className="mt-4">
          <Tabela minLargura={1180}>
            <CabecalhoTabela
              colunas={[
                "Placa",
                "Marca",
                "Modelo",
                "Locadora",
                "Cor",
                "Situação",
                "Última vistoria",
                "Próxima",
                "Prazo",
                { rotulo: "Ações", alinhar: "direita" },
              ]}
            />
            <CorpoTabela>
              {lista.map((m) => {
                const situacaoPrazo = statusPrazo(m);
                const dias = diasRestantes(m);
                return (
                  <LinhaTabela key={m.id} className={LINHA_PRAZO[situacaoPrazo]}>
                    <td className="px-3 py-2.5 font-mono text-[12px]">{m.placa}</td>
                    <td className="px-3 py-2.5 text-[13px]">{m.marca || "—"}</td>
                    <td className="px-3 py-2.5 text-[13px]">{m.modelo || "—"}</td>
                    <td className="px-3 py-2.5 text-[13px]">{nomeLocadora(m.locadoraId)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{m.cor || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Selo tom={m.situacao === "ativa" ? "sucesso" : "neutro"}>
                        {ROTULO_SITUACAO_MOTO[m.situacao].toUpperCase()}
                      </Selo>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground">
                      {data(m.ultimaVistoriaEm)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px]">
                      {data(m.proximaVistoriaEm)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Selo tom={TOM_PRAZO[situacaoPrazo]}>
                        {ROTULO_PRAZO[situacaoPrazo]}
                        {dias !== null && ` · ${dias}d`}
                      </Selo>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Botao variante="fantasma" tamanho="sm" onClick={() => setFicha(m)}>
                          Ver
                        </Botao>
                        <Botao variante="fantasma" tamanho="sm" onClick={() => abrirEdicao(m)}>
                          Editar
                        </Botao>
                        {m.situacao === "ativa" ? (
                          <Botao variante="fantasma" tamanho="sm" onClick={() => excluir(m)}>
                            Excluir
                          </Botao>
                        ) : (
                          <Botao variante="fantasma" tamanho="sm" onClick={() => reativar(m)}>
                            Reativar
                          </Botao>
                        )}
                      </div>
                    </td>
                  </LinhaTabela>
                );
              })}
            </CorpoTabela>
          </Tabela>
        </div>
      )}

      {/* ────────────── Cadastro / edição ────────────── */}
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? "Editar moto" : "Cadastrar moto"}
        descricao="A moto pertence a uma locadora já cadastrada no sistema."
        largura="max-w-3xl"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={salvando}>
              {editando ? "Salvar alterações" : "Cadastrar moto"}
            </Botao>
          </>
        }
      >
        <div className="grid gap-3 p-4">
          <div>
            <BlocoCampos titulo="Dados da moto" descricao="Locadora e placa são obrigatórias">
              <Grade colunas={2}>
                <SeletorLocadora
                  valor={form.locadoraId}
                  locadoras={banco.locadoras}
                  bloqueado={daLocadora}
                  {...(erros["locadoraId"] ? { erro: erros["locadoraId"] } : {})}
                  aoEscolher={(id) => {
                    setForm((f) => ({ ...f, locadoraId: id }));
                    setErros(limparErro("locadoraId"));
                  }}
                />
                <Entrada
                  rotulo="Placa"
                  placeholder="ABC1D23"
                  value={form.placa}
                  maxLength={7}
                  {...(erros["placa"] ? { erro: erros["placa"] } : {})}
                  className="font-mono"
                  onChange={(e) => {
                    const placa = normalizarPlaca(e.target.value);
                    setForm((f) => ({ ...f, placa }));
                    setErros(limparErro("placa"));
                  }}
                />
                <Entrada
                  rotulo="Marca"
                  value={form.marca ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                />
                <Entrada
                  rotulo="Modelo"
                  value={form.modelo ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                />
                <Entrada
                  rotulo="Ano"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.ano ?? ""}
                  {...(erros["ano"] ? { erro: erros["ano"] } : {})}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, ano: e.target.value.replace(/\D/g, "") }));
                    setErros(limparErro("ano"));
                  }}
                />
                <Entrada
                  rotulo="Cor"
                  value={form.cor ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
                />
                <Entrada
                  rotulo="Chassi"
                  dica="Opcional"
                  className="font-mono"
                  value={form.chassi ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, chassi: e.target.value.toUpperCase() }))}
                />
                <Selecao
                  rotulo="Situação"
                  value={form.situacao ?? "ativa"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, situacao: e.target.value as SituacaoMoto }))
                  }
                  opcoes={[
                    { valor: "ativa", rotulo: "ATIVA" },
                    { valor: "inativa", rotulo: "INATIVA (não gera alerta)" },
                  ]}
                />
                <AreaTexto
                  rotulo="Observações"
                  areaClassName="sm:col-span-2"
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </Grade>
            </BlocoCampos>
          </div>

          <div>
            <BlocoCampos
              titulo="Rastreador"
              descricao="Usado por vistorias e recolhimentos desta moto"
            >
              <Grade colunas={2}>
                <Entrada
                  rotulo="Link do host"
                  placeholder="https://..."
                  type="url"
                  inputMode="url"
                  spellCheck={false}
                  areaClassName="sm:col-span-2"
                  className="truncate"
                  value={form.host ?? ""}
                  dica="Link completo, exatamente como enviado pela locadora."
                  {...(erros["host"] ? { erro: erros["host"] } : {})}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, host: e.target.value }));
                    setErros(limparErro("host"));
                  }}
                />
                <Entrada
                  rotulo="PIN"
                  placeholder="6391"
                  className="font-mono"
                  dica="Texto — zeros à esquerda são preservados."
                  value={form.pin ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, pin: normalizarPin(e.target.value) }))}
                />
              </Grade>
            </BlocoCampos>
          </div>
        </div>
      </Modal>

      {/* ────────────── Ficha da moto ────────────── */}
      <Modal
        aberto={Boolean(ficha)}
        aoFechar={() => setFicha(null)}
        titulo={ficha ? `Moto ${ficha.placa}` : "Moto"}
        descricao="Ficha completa, prazo do ciclo e histórico operacional."
        largura="max-w-3xl"
        rodape={
          ficha && (
            <>
              <Botao
                variante="fantasma"
                onClick={() => {
                  const m = ficha;
                  setFicha(null);
                  abrirEdicao(m);
                }}
              >
                Editar
              </Botao>
              {ficha.situacao === "ativa" ? (
                <Botao variante="perigo" onClick={() => excluir(ficha)}>
                  Excluir / inativar
                </Botao>
              ) : (
                <Botao onClick={() => reativar(ficha)}>Reativar</Botao>
              )}
              <Botao onClick={() => solicitar(ficha.id, ficha.locadoraId)}>
                Solicitar vistoria
              </Botao>
            </>
          )
        }
      >
        {ficha && (
          <div className="grid gap-3 p-4">
            <div className="grid gap-px bg-border sm:grid-cols-3">
              {[
                ["Locadora", nomeLocadora(ficha.locadoraId)],
                ["Placa", ficha.placa],
                ["Marca", ficha.marca || "—"],
                ["Modelo", ficha.modelo || "—"],
                ["Ano", ficha.ano || "—"],
                ["Cor", ficha.cor || "—"],
                ["Chassi", ficha.chassi || "—"],
                ["Situação", ROTULO_SITUACAO_MOTO[ficha.situacao].toUpperCase()],
                ["Cadastrada em", data(ficha.criadaEm)],
                ["Última vistoria", data(ficha.ultimaVistoriaEm)],
                ["Próxima vistoria", data(ficha.proximaVistoriaEm)],
                [
                  "Prazo",
                  `${ROTULO_PRAZO[statusPrazo(ficha)]}${
                    diasRestantes(ficha) !== null ? ` · ${diasRestantes(ficha)}d` : ""
                  }`,
                ],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="bg-surface px-4 py-3">
                  <span className="label-caps">{rotulo}</span>
                  <p className="mt-1 truncate text-[13px]">{valor}</p>
                </div>
              ))}
            </div>

            {ficha.observacoes && (
              <div className="border border-border bg-surface px-4 py-3">
                <span className="label-caps">Observações</span>
                <p className="mt-1 whitespace-pre-wrap text-[13px]">{ficha.observacoes}</p>
              </div>
            )}

            <BlocoRastreador dados={ficha} />

            <div className="border border-border bg-surface">
              <p className="border-b border-border px-4 py-2.5 label-caps">
                Vistorias ({vistoriasDa(ficha).length})
              </p>
              {vistoriasDa(ficha).length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
                  Nenhuma vistoria registrada para esta moto.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {vistoriasDa(ficha)
                    .slice(0, 8)
                    .map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <span className="font-mono text-[12px]">{v.codigo}</span>
                        <span className="text-[12.5px] text-muted-foreground">
                          {data(v.solicitadaEm)}
                        </span>
                        <Selo tom="neutro">{ROTULO_STATUS_VISTORIA[v.status]}</Selo>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="border border-border bg-surface">
              <p className="border-b border-border px-4 py-2.5 label-caps">
                Recolhimentos com esta placa ({ordensDa(ficha).length})
              </p>
              {ordensDa(ficha).length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
                  Nenhum recolhimento vinculado.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {ordensDa(ficha)
                    .slice(0, 8)
                    .map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <span className="font-mono text-[12px]">{o.codigo}</span>
                        <span className="text-[12.5px] text-muted-foreground">
                          {data(o.criadaEm)}
                        </span>
                        <Selo tom="neutro">{o.status}</Selo>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {dialogo}
    </Pagina>
  );
}
