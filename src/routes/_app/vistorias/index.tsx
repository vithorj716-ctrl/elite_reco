/**
 * Painel de Vistorias da central: números do ciclo, fila por situação,
 * distribuição individual ou em massa e abertura de novas vistorias.
 *
 * Locadoras, agentes e tabelas de preço são os mesmos do restante do sistema.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Search, Send } from "lucide-react";
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
import { Entrada, Grade, Selecao } from "@/components/negocio/formulario";
import {
  CamposVistoria,
  VISTORIA_VAZIA,
  type FormularioVistoria,
} from "@/components/negocio/form-vistoria";
import { useConfirmacao } from "@/components/app/confirmar";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { VistoriasService } from "@/services/vistorias.service";
import { dinheiro } from "@/domain/services/financeiro";
import {
  nomeAgente,
  nomeLocadora,
  placaDaVistoria,
  resumoVistorias,
  valorCobrancaVistoria,
} from "@/domain/services/vistorias";
import {
  ROTULO_ORIGEM_VISTORIA,
  ROTULO_STATUS_VISTORIA,
  type StatusVistoria,
} from "@/domain/types";

export const Route = createFileRoute("/_app/vistorias/")({
  head: () => ({
    meta: [
      { title: "Vistorias de motos — Recolhe" },
      {
        name: "description",
        content:
          "Fila de vistorias das locadoras: distribuição para agentes, execução em campo e ciclo de 40 dias.",
      },
      { property: "og:title", content: "Vistorias de motos — Recolhe" },
      {
        property: "og:description",
        content: "Controle do ciclo de vistorias, distribuição e conclusão em campo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaVistorias,
});

const ABAS: { valor: StatusVistoria | "todas"; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Aguardando" },
  { valor: "distribuida", rotulo: "Distribuídas" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "concluida", rotulo: "Concluídas" },
  { valor: "cancelada", rotulo: "Canceladas" },
  { valor: "todas", rotulo: "Todas" },
];

const TOM_STATUS = {
  pendente: "neutro",
  distribuida: "info",
  em_andamento: "primario",
  aguardando_complementacao: "alerta",
  concluida: "sucesso",
  cancelada: "perigo",
} as const;

function TelaVistorias() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const { pedir, dialogo } = useConfirmacao();
  const daCentral = usuario?.papel === "super_admin" || usuario?.papel === "operador";
  const daLocadora = usuario?.papel === "cliente";

  const [aba, setAba] = useState<StatusVistoria | "todas">("pendente");
  const [busca, setBusca] = useState("");
  const [locadoraFiltro, setLocadoraFiltro] = useState("todas");
  const [selecao, setSelecao] = useState<string[]>([]);
  const [distribuindo, setDistribuindo] = useState(false);
  const [agenteEscolhido, setAgenteEscolhido] = useState("");
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    locadoraId: "",
    motoId: "",
    ...VISTORIA_VAZIA,
  });

  const resumo = useMemo(() => resumoVistorias(banco), [banco]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return banco.vistorias.filter((v) => {
      if (aba !== "todas" && v.status !== aba) return false;
      if (locadoraFiltro !== "todas" && v.locadoraId !== locadoraFiltro) return false;
      if (!termo) return true;
      const placa = placaDaVistoria(banco, v).toLowerCase();
      return (
        placa.includes(termo) ||
        v.codigo.toLowerCase().includes(termo) ||
        nomeLocadora(banco, v.locadoraId).toLowerCase().includes(termo)
      );
    });
  }, [banco, aba, busca, locadoraFiltro]);

  const motosDaLocadora = useMemo(
    () => banco.motos.filter((m) => m.locadoraId === form.locadoraId && m.situacao === "ativa"),
    [banco.motos, form.locadoraId],
  );

  const alternar = (id: string) =>
    setSelecao((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const distribuir = async () => {
    if (!agenteEscolhido) {
      toast.error("Escolha o agente responsável.");
      return;
    }
    try {
      await VistoriasService.distribuir(selecao, agenteEscolhido);
      toast.success(`${selecao.length} vistoria(s) distribuída(s).`);
      setSelecao([]);
      setDistribuindo(false);
      setAgenteEscolhido("");
      sincronizar(["vistorias", "notificacoes"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const abrirNova = () => {
    setEditando(null);
    setForm({
      locadoraId: daLocadora ? (usuario?.locadoraId ?? "") : "",
      motoId: "",
      ...VISTORIA_VAZIA,
    });
    setNova(true);
  };

  const abrirEdicao = (id: string) => {
    const v = banco.vistorias.find((x) => x.id === id);
    if (!v) return;
    setEditando(id);
    setForm({
      locadoraId: v.locadoraId,
      motoId: v.motoId,
      observacoes: v.observacoes,
      contatoNome: v.contatoNome,
      contatoTelefone: v.contatoTelefone,
      contatoEmail: v.contatoEmail,
      endereco: v.endereco,
      bairro: v.bairro,
      cidade: v.cidade,
      uf: v.uf,
      cep: v.cep,
      linkMaps: v.linkMaps,
      host: v.host,
      pin: v.pin,
      pinValidade: v.pinValidade,
    });
    setNova(true);
  };

  const alterarForm = (mudanca: Partial<FormularioVistoria>) =>
    setForm((f) => ({ ...f, ...mudanca }));

  const criar = async () => {
    if (!form.locadoraId || !form.motoId) {
      toast.error("Escolha a locadora e a moto.");
      return;
    }
    const { locadoraId, motoId, ...dados } = form;
    setSalvando(true);
    try {
      if (editando) {
        await VistoriasService.atualizar(editando, dados);
        toast.success("Vistoria atualizada.");
      } else {
        await VistoriasService.solicitar({
          motoId,
          locadoraId,
          origem: daLocadora ? "locadora" : "central",
          ...dados,
        });
        toast.success("Vistoria aberta.");
      }
      setNova(false);
      setEditando(null);
      sincronizar(["vistorias", "motos", "notificacoes"]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string, codigo: string) => {
    const ok = await pedir({
      titulo: `Excluir a vistoria ${codigo}?`,
      texto: "A exclusão é definitiva. Vistorias concluídas ou faturadas não podem ser excluídas.",
      destrutivo: true,
      confirmar: "Excluir",
    });
    if (!ok) return;
    try {
      await VistoriasService.excluir(id);
      toast.success("Vistoria excluída.");
      sincronizar(["vistorias"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Pagina
      titulo="Vistorias de motos"
      descricao="Ciclo obrigatório de 40 dias por moto — distribuição, execução em campo e faturamento pelas tabelas já cadastradas."
      acoes={
        <>
          <Botao variante="fantasma" onClick={abrirNova}>
            Nova vistoria
          </Botao>
          <Link to="/vistorias/motos">
            <Botao variante="linha">Motos cadastradas</Botao>
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Motos ativas" valor={resumo.motosAtivas} />
        <Metrica rotulo="Aguardando vistoria" valor={resumo.pendentes} destaque />
        <Metrica rotulo="Próximas do vencimento" valor={resumo.proximas} nota="7 dias ou menos" />
        <Metrica rotulo="Vencidas" valor={resumo.vencidas} nota="fora do ciclo de 40 dias" />
      </div>

      <div className="mt-5">
        <Abas valor={aba} aoTrocar={setAba} itens={ABAS} />
      </div>

      <BarraFiltros>
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Entrada
            rotulo="Buscar"
            placeholder="Placa, código ou locadora"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Selecao
          rotulo="Locadora"
          value={locadoraFiltro}
          onChange={(e) => setLocadoraFiltro(e.target.value)}
          opcoes={[
            { valor: "todas", rotulo: "Todas as locadoras" },
            ...banco.locadoras.map((l) => ({ valor: l.id, rotulo: l.nome })),
          ]}
        />
        {daCentral && selecao.length > 0 && (
          <Botao onClick={() => setDistribuindo(true)}>
            <Send className="size-3.5" aria-hidden /> Distribuir {selecao.length}
          </Botao>
        )}
      </BarraFiltros>

      {lista.length === 0 ? (
        <div className="mt-4">
          <Vazio
            icone={ClipboardCheck}
            titulo="Nenhuma vistoria nesta situação"
            texto="Abra uma vistoria ou aguarde a solicitação das locadoras."
          />
        </div>
      ) : (
        <div className="mt-4">
          <Tabela minLargura={980}>
            <CabecalhoTabela
              extra={daCentral ? <th className="w-9 px-3 py-2.5" aria-label="Seleção" /> : null}
              colunas={[
                "Código",
                "Placa",
                "Locadora",
                "Agente",
                "Origem",
                "Situação",
                { rotulo: "Valor", alinhar: "direita" },
                { rotulo: "Ações", alinhar: "direita" },
              ]}
            />

            <CorpoTabela>
              {lista.map((v) => (
                <LinhaTabela key={v.id} ativa={selecao.includes(v.id)}>
                  {daCentral && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${v.codigo}`}
                        checked={selecao.includes(v.id)}
                        onChange={() => alternar(v.id)}
                        disabled={v.status === "concluida" || v.status === "cancelada"}
                        className="size-3.5 accent-[hsl(var(--primary))]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <Link
                      to="/vistorias/$id"
                      params={{ id: v.id }}
                      className="font-mono text-[12px] text-primary hover:underline"
                    >
                      {v.codigo}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px]">{placaDaVistoria(banco, v)}</td>
                  <td className="px-3 py-2.5 text-[13px]">{nomeLocadora(banco, v.locadoraId)}</td>
                  <td className="px-3 py-2.5 text-[13px]">{nomeAgente(banco, v.agenteId)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    {ROTULO_ORIGEM_VISTORIA[v.origem]}
                  </td>
                  <td className="px-3 py-2.5">
                    <Selo tom={TOM_STATUS[v.status]}>{ROTULO_STATUS_VISTORIA[v.status]}</Selo>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                    {dinheiro(valorCobrancaVistoria(banco, v))}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {(daCentral || daLocadora) &&
                    v.status !== "concluida" &&
                    v.status !== "cancelada" ? (
                      <div className="flex justify-end gap-1">
                        <Botao variante="fantasma" tamanho="sm" onClick={() => abrirEdicao(v.id)}>
                          Editar
                        </Botao>
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          onClick={() => excluir(v.id, v.codigo)}
                        >
                          Excluir
                        </Botao>
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </td>
                </LinhaTabela>
              ))}
            </CorpoTabela>
          </Tabela>
        </div>
      )}

      <Modal
        aberto={distribuindo}
        aoFechar={() => setDistribuindo(false)}
        titulo="Distribuir vistorias"
        descricao={`${selecao.length} vistoria(s) para um agente já cadastrado.`}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setDistribuindo(false)}>
              Cancelar
            </Botao>
            <Botao onClick={distribuir}>Distribuir</Botao>
          </>
        }
      >
        <div className="p-4">
          <Selecao
            rotulo="Agente responsável"
            value={agenteEscolhido}
            onChange={(e) => setAgenteEscolhido(e.target.value)}
            opcoes={[
              { valor: "", rotulo: "Escolha o agente" },
              ...banco.agentes
                .filter((a) => a.ativo)
                .map((a) => ({ valor: a.id, rotulo: `${a.nome} — ${a.cidade}` })),
            ]}
          />
        </div>
      </Modal>

      <Modal
        aberto={nova}
        aoFechar={() => setNova(false)}
        titulo={editando ? "Editar vistoria" : "Nova vistoria"}
        descricao="A moto precisa estar cadastrada na locadora. Os dados de contato, endereço e rastreador vão para o app do agente."
        largura="max-w-3xl"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setNova(false)}>
              Cancelar
            </Botao>
            <Botao onClick={criar} carregando={salvando}>
              {editando ? "Salvar alterações" : "Abrir vistoria"}
            </Botao>
          </>
        }
      >
        <div className="grid gap-5 p-4">
          <Grade colunas={2}>
            <Selecao
              rotulo="Locadora"
              value={form.locadoraId}
              disabled={daLocadora || !!editando}
              onChange={(e) => setForm((f) => ({ ...f, locadoraId: e.target.value, motoId: "" }))}
              opcoes={[
                { valor: "", rotulo: "Escolha" },
                ...banco.locadoras.map((l) => ({ valor: l.id, rotulo: l.nome })),
              ]}
            />
            <Selecao
              rotulo="Moto"
              value={form.motoId}
              onChange={(e) => setForm((f) => ({ ...f, motoId: e.target.value }))}
              disabled={!form.locadoraId || !!editando}
              opcoes={[
                { valor: "", rotulo: form.locadoraId ? "Escolha" : "Escolha a locadora" },
                ...motosDaLocadora.map((m) => ({
                  valor: m.id,
                  rotulo: `${m.placa} — ${m.modelo || "sem modelo"}`,
                })),
              ]}
            />
          </Grade>
          <CamposVistoria valor={form} aoAlterar={alterarForm} />
        </div>
      </Modal>
      {dialogo}
    </Pagina>
  );
}
