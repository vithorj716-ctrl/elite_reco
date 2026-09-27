import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, Check, FileText, SquarePen, X } from "lucide-react";
import {
  ModalTransferirAgente,
  podeTransferirAgente,
} from "@/components/negocio/transferir-agente";
import { Botao, Pagina, Prioridade_, Status, Vazio } from "@/components/app/ui";
import { AcoesOrdem } from "@/components/negocio/acoes-ordem";
import { DefinicaoOperacao } from "@/components/negocio/definicao-operacao";
import { FinanceiroOrdem } from "@/components/negocio/financeiro-ordem";
import { AvatarAgente } from "@/components/negocio/foto-agente";
import { PainelCampo } from "@/components/negocio/painel-campo";
import {
  GaleriaFotos,
  LinhaTempoCaptura,
  PainelEvidencias,
} from "@/components/negocio/evidencias";
import { EASE } from "@/lib/animacao";
import { moedaBR } from "@/lib/moeda";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { OrdensService } from "@/services/ordens.service";
import { CHAVES, PADRAO_HORARIO_ESPECIAL } from "@/services/configuracoes.service";
import { nomeServico, servicosDaLocadora } from "@/domain/services/catalogo";
import { type Ordem, type Prioridade } from "@/domain/types";

export const Route = createFileRoute("/_app/ordens/$id")({
  head: () => ({
    meta: [
      { title: "Ficha da ordem — Recolhe" },
      {
        name: "description",
        content:
          "Ficha completa do recolhimento: dados, contatos, rastreamento, evidências, checklist, financeiro e histórico.",
      },
      { property: "og:title", content: "Ficha da ordem — Recolhe" },
      { property: "og:description", content: "Rastreabilidade completa de cada recolhimento." },
    ],
  }),
  component: Ficha,
});

const CAMPO =
  "w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none transition-colors focus:border-primary";

const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];

function Edicao({ ordem, aoFechar }: { ordem: Ordem; aoFechar: () => void }) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [f, setF] = useState({
    placa: ordem.placa,
    marca: ordem.marca,
    modelo: ordem.modelo,
    cor: ordem.cor,
    locatario: ordem.locatario ?? "",
    telefone: ordem.telefone,
    telefoneSecundario: ordem.telefoneSecundario ?? "",
    host: ordem.host ?? "",
    pin: ordem.pin ?? "",
    endereco: ordem.endereco,
    bairro: ordem.bairro ?? "",
    cidade: ordem.cidade,
    uf: ordem.uf ?? "",
    prioridade: ordem.prioridade,
    servicoId: ordem.servicoId ?? "",
    observacoes: ordem.observacoes ?? "",
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await OrdensService.atualizar(ordem.id, {
        placa: f.placa.toUpperCase(),
        marca: f.marca,
        modelo: f.modelo,
        cor: f.cor,
        locatario: f.locatario,
        telefone: f.telefone,
        telefone_secundario: f.telefoneSecundario,
        host: f.host,
        pin: f.pin,
        endereco: f.endereco,
        bairro: f.bairro,
        cidade: f.cidade,
        uf: f.uf,
        prioridade: f.prioridade,
        servico_id: f.servicoId || null,
        observacoes: f.observacoes,
      });
      await sincronizar("ordens");
      toast.success("Ordem atualizada.");
      aoFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const texto = (chave: keyof typeof f, rotulo: string) => (
    <div key={chave}>
      <label className="label-caps" htmlFor={`edit-${chave}`}>
        {rotulo}
      </label>
      <input
        id={`edit-${chave}`}
        className={`${CAMPO} mt-1`}
        value={String(f[chave])}
        onChange={(e) => setF({ ...f, [chave]: e.target.value })}
      />
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="mt-6 border border-primary/40"
    >
      <p className="label-caps border-b border-border px-4 py-2.5">Editar informações da ordem</p>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {texto("placa", "Placa")}
        {texto("marca", "Marca")}
        {texto("modelo", "Modelo")}
        {texto("cor", "Cor")}
        {texto("locatario", "Locatário")}
        {texto("telefone", "Telefone")}
        {texto("telefoneSecundario", "Telefone secundário")}
        {texto("host", "Host do rastreador")}
        {texto("pin", "PIN")}
        {texto("endereco", "Endereço")}
        {texto("bairro", "Bairro")}
        {texto("cidade", "Cidade")}
        {texto("uf", "UF")}
        <div>
          <label className="label-caps" htmlFor="edit-prioridade">
            Prioridade
          </label>
          <select
            id="edit-prioridade"
            className={`${CAMPO} mt-1`}
            value={f.prioridade}
            onChange={(e) => setF({ ...f, prioridade: e.target.value as Prioridade })}
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p} className="bg-surface">
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-caps" htmlFor="edit-servico">
            Serviço
          </label>
          <select
            id="edit-servico"
            className={`${CAMPO} mt-1`}
            value={f.servicoId}
            onChange={(e) => setF({ ...f, servicoId: e.target.value })}
          >
            <option value="" className="bg-surface">
              — selecione —
            </option>
            {servicosDaLocadora(banco, ordem.locadoraId).map((s) => (
              <option key={s.id} value={s.id} className="bg-surface">
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label-caps" htmlFor="edit-obs">
            Observações
          </label>
          <textarea
            id="edit-obs"
            rows={2}
            className={`${CAMPO} mt-1 resize-none`}
            value={f.observacoes}
            onChange={(e) => setF({ ...f, observacoes: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Botao variante="fantasma" tamanho="sm" onClick={aoFechar}>
          <X className="size-3.5" /> Cancelar
        </Botao>
        <Botao tamanho="sm" carregando={salvando} onClick={() => void salvar()}>
          <Check className="size-3.5" /> Salvar alterações
        </Botao>
      </div>
    </motion.section>
  );
}

/**
 * Definição administrativa da ordem (item obrigatório do fluxo).
 *
 * Enquanto a ordem está em `pendente_definicao` nenhum agente a enxerga. Aqui o
 * administrador vê a REFERÊNCIA da tabela (cobrança e repasse, com os adicionais
 * de horário independentes) e confirma os valores, que são gravados na própria
 * ordem pelo banco (`aprovar_distribuicao`) junto de quem definiu e quando.
 */
function DefinicaoPendente({ ordem }: { ordem: Ordem }) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [abrir, setAbrir] = useState(false);

  const distribuicao =
    banco.distribuicoes?.find(
      (d) => d.ordemId === ordem.id && d.status === "aguardando_definicao",
    ) ?? null;

  const linhas: Array<[string, string]> = [
    ["Placa", ordem.placa],
    ["Locadora", banco.locadoras.find((l) => l.id === ordem.locadoraId)?.nome ?? "—"],
    ["Serviço", nomeServico(banco, ordem)],
    ["Criada em", new Date(ordem.criadaEm).toLocaleString("pt-BR")],
    ["Horário especial", ordem.horarioEspecial ? "Sim (pelo horário do lançamento)" : "Não"],
    [
      "Referência da locadora",
      distribuicao ? moedaBR(distribuicao.referenciaCobranca) : "—",
    ],
    [
      "Adicional de referência da locadora",
      distribuicao ? moedaBR(distribuicao.referenciaAdicionalCobranca) : "—",
    ],
    ["Referência do agente", distribuicao ? moedaBR(distribuicao.referenciaPagamento) : "—"],
    [
      "Adicional de referência do agente",
      distribuicao ? moedaBR(distribuicao.referenciaAdicionalPagamento) : "—",
    ],
  ];

  const inicioEspecial =
    banco.configuracoes[CHAVES.horarioEspecialInicio] ?? PADRAO_HORARIO_ESPECIAL;

  return (
    <section className="mt-6 border border-amber-500/40">
      <p className="label-caps border-b border-amber-500/40 px-4 py-2.5 text-amber-500">
        {ordem.horarioEspecial
          ? `Lançada após ${inicioEspecial} — precisa da sua confirmação`
          : "Aguardando definição administrativa"}
      </p>
      <p className="border-b border-amber-500/40 px-4 py-3 text-[12.5px] text-muted-foreground">
        {ordem.horarioEspecial
          ? `Esta ordem entrou às ${new Date(ordem.criadaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}, depois do horário especial (${inicioEspecial}). Por isso ela não vai automaticamente para os agentes: confirme abaixo, em "Definir e liberar", quanto será cobrado da locadora e quanto cada agente recebe. Depois disso ela segue normalmente e os valores continuam podendo ser ajustados na hora de distribuir. Ordens lançadas antes de ${inicioEspecial} não passam por esta etapa.`
          : "Esta ordem está sem valor na tabela de preços deste serviço. Informe os valores em \"Definir e liberar\" para ela seguir para os agentes."}
      </p>
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {linhas.map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <dt className="label-caps">{k}</dt>
            <dd className="mt-1 text-[13px] text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
        <p className="text-[12px] text-muted-foreground">
          Nenhum agente enxerga esta ordem antes da liberação. Os valores confirmados ficam
          gravados nela e não mudam se a tabela de preços for alterada depois.
        </p>
        <Botao variante="solido" tamanho="sm" disabled={!distribuicao} onClick={() => setAbrir(true)}>
          <Check className="size-3.5" /> Definir e liberar
        </Botao>
      </div>
      <DefinicaoOperacao
        distribuicao={abrir ? distribuicao : null}
        aoFechar={() => setAbrir(false)}
        aoConcluir={() => {
          setAbrir(false);
          void sincronizar();
        }}
      />
    </section>
  );
}


function Ficha() {
  const { id } = Route.useParams();
  const banco = useBanco();
  const { usuario } = useSessao();
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const ordem = banco.ordens.find((o) => o.id === id);

  if (!ordem) {
    return (
      <Pagina titulo="Ordem não encontrada">
        <Vazio
          titulo="Registro inexistente"
          texto="Esta ordem pode ter sido removida ou você não tem acesso a ela."
          acao={
            <Link to="/ordens" className="press border border-border-strong px-3 py-2 text-[13px] hover:border-primary hover:text-primary">
              Voltar à fila
            </Link>
          }
        />
      </Pagina>
    );
  }

  const equipe = usuario?.papel === "super_admin" || usuario?.papel === "operador";
  const loc = banco.locadoras.find((l) => l.id === ordem.locadoraId);
  const ag = banco.agentes.find((a) => a.id === ordem.agenteId);
  const aux = banco.agentes.find((a) => a.id === ordem.agenteAuxiliarId);

  const campos: Array<[string, string]> = [
    ["Locadora", loc?.nome ?? "—"],
    ["Marca / modelo", `${ordem.marca} ${ordem.modelo}`],
    ["Ano", ordem.ano],
    ["Cor", ordem.cor],
    ["Valor pendente", moedaBR(ordem.valorPendente)],
    ["Serviço", nomeServico(banco, ordem)],
    ["Agente", ag?.nome ?? "não distribuída"],
    ["Criada em", new Date(ordem.criadaEm).toLocaleString("pt-BR")],
    ...(ordem.locatario ? ([["Locatário", ordem.locatario]] as Array<[string, string]>) : []),
    ...(ordem.cpf ? ([["CPF", ordem.cpf]] as Array<[string, string]>) : []),
    ...(ordem.situacaoFinanceira
      ? ([["Situação financeira", ordem.situacaoFinanceira]] as Array<[string, string]>)
      : []),
    ...(ordem.ultimoRastreio
      ? ([["Último rastreio", ordem.ultimoRastreio]] as Array<[string, string]>)
      : []),
  ];

  return (
    <Pagina
      titulo={ordem.placa}
      descricao={`${ordem.codigo} • ${ordem.cidade}`}
      acoes={
        <div className="flex items-center gap-2">
          {equipe && (
            <Botao variante="linha" tamanho="sm" onClick={() => setEditando((v) => !v)}>
              <SquarePen className="size-3.5" /> {editando ? "Fechar edição" : "Editar"}
            </Botao>
          )}
          {equipe && podeTransferirAgente(ordem) && (
            <Botao variante="linha" tamanho="sm" onClick={() => setTransferindo(true)}>
              <ArrowLeftRight className="size-3.5" />{" "}
              {ordem.agenteId ? "Transferir agente" : "Atribuir agente"}
            </Botao>
          )}
          <Link
            to="/documentos/$tipo/$id"
            params={{ tipo: "laudo", id: ordem.id }}
            className="press inline-flex items-center gap-1.5 border border-primary/50 px-3 py-2 text-[13px] text-primary hover:bg-primary/10"
          >
            <FileText className="size-3.5" /> Laudo
          </Link>
          <Link
            to="/ordens"
            className="press inline-flex items-center gap-1.5 border border-border-strong px-3 py-2 text-[13px] hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="size-3.5" /> Fila
          </Link>
          <AcoesOrdem
            ordem={ordem}
            aoEditar={() => setEditando(true)}
          />
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Status valor={ordem.status} />
        <Prioridade_ valor={ordem.prioridade} />
      </div>

      {ordem.resumoIa && (
        <div className="mt-4 border-l-2 border-primary bg-surface px-4 py-3">
          <p className="label-caps mb-1">Resumo operacional</p>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
            {ordem.resumoIa}
          </p>
        </div>
      )}

      <AnimatePresence>
        {editando && <Edicao ordem={ordem} aoFechar={() => setEditando(false)} />}
      </AnimatePresence>

      {equipe && ordem.status === "pendente_definicao" && <DefinicaoPendente ordem={ordem} />}



      {equipe && (
        <ModalTransferirAgente
          ordem={ordem}
          aberto={transferindo}
          aoFechar={() => setTransferindo(false)}
        />
      )}


      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <PainelCampo ordem={ordem} />

          {(ag || aux) && (
            <section className="border border-border">
              <p className="label-caps border-b border-border px-4 py-2.5">Equipe em campo</p>
              <div className="grid gap-px bg-border sm:grid-cols-2">
                <div className="flex items-center gap-3 bg-surface px-4 py-3">
                  <AvatarAgente foto={ag?.foto} nome={ag?.nome} tamanho={40} />
                  <div className="min-w-0">
                    <p className="label-caps">Agente principal</p>
                    <p className="truncate text-[13px]">{ag?.nome ?? "não distribuída"}</p>
                  </div>
                </div>
                {aux && (
                  <div className="flex items-center gap-3 bg-surface px-4 py-3">
                    <AvatarAgente foto={aux.foto} nome={aux.nome} tamanho={40} />
                    <div className="min-w-0">
                      <p className="label-caps">Agente auxiliar</p>
                      <p className="truncate text-[13px]">{aux.nome}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="border border-border">
            <p className="label-caps border-b border-border px-4 py-2.5">Dados da motocicleta</p>
            <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {campos.map(([k, v]) => (
                <div key={k} className="bg-surface px-4 py-3">
                  <dt className="label-caps">{k}</dt>
                  <dd className="mt-1 text-[13px] text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            {ordem.observacoes && (
              <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
                {ordem.observacoes}
              </p>
            )}
          </section>

          <GaleriaFotos ordem={ordem} />

          <PainelEvidencias ordem={ordem} podeEnviar={equipe} />

          <section className="border border-border">
            <p className="label-caps border-b border-border px-4 py-2.5">Checklist</p>
            {!ordem.checklist ? (
              <p className="px-4 py-6 text-[13px] text-muted-foreground">
                Checklist ainda não preenchido.
              </p>
            ) : (
              <ul className="grid gap-px bg-border sm:grid-cols-2">
                {ordem.checklist.map((c) => (
                  <li key={c.item} className="flex items-center gap-3 bg-surface px-4 py-2.5">
                    <span className="text-[13px] text-foreground">{c.item}</span>
                    <span
                      className={`ml-auto font-mono text-[10px] uppercase tracking-[0.12em] ${
                        c.conceito === "bom"
                          ? "text-success"
                          : c.conceito === "regular"
                            ? "text-warning"
                            : "text-destructive"
                      }`}
                    >
                      {c.conceito}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ordem.termoAceito && (
              <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
                Termo de responsabilidade aceito na finalização.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <FinanceiroOrdem ordem={ordem} podeEditar={equipe} />
          <LinhaTempoCaptura ordem={ordem} />
          {equipe && (
            <button
              onClick={() => void navigate({ to: "/operacao" })}
              className="press w-full border border-border px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:border-primary hover:text-primary"
            >
              Voltar para a Operação do dia
            </button>
          )}
        </div>
      </div>
    </Pagina>
  );
}
