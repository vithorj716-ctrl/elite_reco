/**
 * Ficha completa da vistoria: moto, situação, checklist, fotos com marca
 * d'água, histórico imutável e o financeiro pelas tabelas já cadastradas.
 */
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";
import { Botao, Metrica, Modal, Pagina, Secao, Selo, Vazio } from "@/components/app/ui";
import { Leitura, Selecao } from "@/components/negocio/formulario";
import { useConfirmacao } from "@/components/app/confirmar";
import { BlocoRastreador } from "@/components/negocio/rastreador";
import { GaleriaVistoria } from "@/components/negocio/galeria-vistoria";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { VistoriasService } from "@/services/vistorias.service";
import { dinheiro } from "@/domain/services/financeiro";
import {
  avariasDaVistoria,
  fotosDaAvaria,
  itensDaVistoria,
  motoDaVistoria,
  nomeAgente,
  nomeLocadora,
  valorCobrancaVistoria,
  valorPagamentoVistoria,
} from "@/domain/services/vistorias";
import {
  ROTULO_CONDICAO,
  ROTULO_ORIGEM_VISTORIA,
  ROTULO_STATUS_VISTORIA,
  TOM_CONDICAO,
} from "@/domain/types";

export const Route = createFileRoute("/_app/vistorias/$id")({
  head: () => ({
    meta: [
      { title: "Ficha da vistoria — Recolhe" },
      {
        name: "description",
        content: "Checklist, fotos, histórico e financeiro de uma vistoria de moto.",
      },
      { property: "og:title", content: "Ficha da vistoria — Recolhe" },
      {
        property: "og:description",
        content: "Tudo o que aconteceu na vistoria, do pedido à conclusão em campo.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FichaVistoria,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-[13px] text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-[13px]">Vistoria não encontrada.</div>,
});

function FichaVistoria() {
  const { id } = useParams({ from: "/_app/vistorias/$id" });
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const { pedir, pedirMotivo, dialogo } = useConfirmacao();
  const navegar = useNavigate();
  const daCentral = usuario?.papel === "super_admin" || usuario?.papel === "operador";

  const [distribuindo, setDistribuindo] = useState(false);
  const [agenteEscolhido, setAgenteEscolhido] = useState("");

  const vistoria = banco.vistorias.find((v) => v.id === id) ?? null;
  const moto = vistoria ? motoDaVistoria(banco, vistoria) : null;

  const evidencias = useMemo(
    () => banco.evidenciasVistoria.filter((e) => e.vistoriaId === id),
    [banco.evidenciasVistoria, id],
  );
  const itens = useMemo(
    () => (vistoria ? itensDaVistoria(banco, vistoria.id) : []),
    [banco, vistoria],
  );
  const avarias = useMemo(
    () => (vistoria ? avariasDaVistoria(banco, vistoria.id) : []),
    [banco, vistoria],
  );
  const historico = useMemo(
    () =>
      banco.historicoVistoria
        .filter((h) => h.vistoriaId === id)
        .sort((a, b) => b.quando.localeCompare(a.quando)),
    [banco.historicoVistoria, id],
  );

  if (!vistoria) {
    return (
      <Pagina titulo="Vistoria" descricao="Registro não encontrado.">
        <Vazio titulo="Vistoria não encontrada" texto="Ela pode ter sido removida da fila." />
      </Pagina>
    );
  }

  const distribuir = async () => {
    if (!agenteEscolhido) {
      toast.error("Escolha o agente responsável.");
      return;
    }
    try {
      await VistoriasService.distribuir([vistoria.id], agenteEscolhido);
      toast.success("Vistoria distribuída.");
      setDistribuindo(false);
      sincronizar(["vistorias", "notificacoes"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const cancelar = async () => {
    const motivo = await pedirMotivo({
      titulo: "Cancelar vistoria",
      texto: "O histórico permanece registrado.",
      motivo: "Motivo do cancelamento",
      destrutivo: true,
    });
    if (!motivo) return;
    try {
      await VistoriasService.cancelar(vistoria.id, motivo);
      toast.success("Vistoria cancelada.");
      sincronizar(["vistorias"]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const excluir = async () => {
    const ok = await pedir({
      titulo: "Excluir vistoria",
      texto:
        "A exclusão é definitiva. Vistorias concluídas ou faturadas são bloqueadas pelo sistema.",
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await VistoriasService.excluir(vistoria.id);
      toast.success("Vistoria excluída.");
      sincronizar(["vistorias"]);
      navegar({ to: "/vistorias" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Pagina
      titulo={`Vistoria ${vistoria.codigo}`}
      descricao={`${moto?.placa ?? "—"} · ${nomeLocadora(banco, vistoria.locadoraId)}`}
      acoes={
        <>
          <Link to="/vistorias">
            <Botao variante="fantasma">
              <ArrowLeft className="size-3.5" aria-hidden /> Voltar
            </Botao>
          </Link>
          {daCentral && vistoria.status !== "concluida" && vistoria.status !== "cancelada" && (
            <>
              <Botao variante="linha" onClick={() => setDistribuindo(true)}>
                {vistoria.agenteId ? "Reatribuir" : "Distribuir"}
              </Botao>
              <Botao variante="perigo" onClick={cancelar}>
                Cancelar
              </Botao>
            </>
          )}
          <Link to="/documentos/$tipo/$id" params={{ tipo: "laudo-vistoria", id: vistoria.id }}>
            <Botao variante="linha">
              <FileText className="size-3.5" aria-hidden /> Laudo
            </Botao>
          </Link>
          {daCentral && (
            <Botao variante="perigo" onClick={excluir}>
              Excluir
            </Botao>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Situação" valor={ROTULO_STATUS_VISTORIA[vistoria.status]} destaque />
        <Metrica rotulo="Agente" valor={nomeAgente(banco, vistoria.agenteId)} />
        <Metrica
          rotulo="A receber da locadora"
          valor={dinheiro(valorCobrancaVistoria(banco, vistoria))}
        />
        <Metrica
          rotulo="A pagar ao agente"
          valor={dinheiro(valorPagamentoVistoria(banco, vistoria))}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Secao titulo="Moto vistoriada" padding={false}>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              <Leitura rotulo="Placa" valor={moto?.placa ?? "—"} />
              <Leitura rotulo="Marca" valor={moto?.marca || "—"} />
              <Leitura rotulo="Modelo" valor={moto?.modelo || "—"} />
              <Leitura rotulo="Ano" valor={moto?.ano || "—"} />
              <Leitura rotulo="Cor" valor={moto?.cor || "—"} />
              <Leitura rotulo="Origem" valor={ROTULO_ORIGEM_VISTORIA[vistoria.origem]} />
              <Leitura
                rotulo="Última vistoria"
                valor={
                  moto?.ultimaVistoriaEm
                    ? new Date(moto.ultimaVistoriaEm).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
              <Leitura
                rotulo="Próxima vistoria"
                valor={
                  moto?.proximaVistoriaEm
                    ? new Date(moto.proximaVistoriaEm).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
              <Leitura rotulo="Observações" valor={vistoria.observacoes || "—"} />
            </div>
          </Secao>

          <Secao titulo="Dados da solicitação" padding={false}>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              <Leitura rotulo="Contato" valor={vistoria.contatoNome || "—"} />
              <Leitura rotulo="Telefone" valor={vistoria.contatoTelefone || "—"} />
              <Leitura rotulo="E-mail" valor={vistoria.contatoEmail || "—"} />
              <Leitura rotulo="Endereço" valor={vistoria.endereco || "—"} />
              <Leitura rotulo="Bairro" valor={vistoria.bairro || "—"} />
              <Leitura
                rotulo="Cidade / UF"
                valor={`${vistoria.cidade || "—"} / ${vistoria.uf || "—"}`}
              />
              <Leitura rotulo="CEP" valor={vistoria.cep || "—"} />
            </div>
          </Secao>

          <Secao titulo="Rastreador" padding={false}>
            <BlocoRastreador
              className="border-0"
              dados={{
                host: moto?.host || vistoria.host,
                pin: moto?.pin || vistoria.pin,
              }}
            />
          </Secao>

          <Secao titulo="Dados da inspeção" padding={false}>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              <Leitura
                rotulo="Quilometragem"
                valor={
                  vistoria.km === undefined || vistoria.km === null
                    ? "—"
                    : `${vistoria.km.toLocaleString("pt-BR")} km`
                }
              />
              <Leitura
                rotulo="Geolocalização"
                valor={vistoria.latitude ? `${vistoria.latitude}, ${vistoria.longitude}` : "—"}
              />
              <Leitura rotulo="Avarias registradas" valor={String(avarias.length)} />
            </div>
          </Secao>

          <Secao titulo="Linha do tempo em campo" padding={false}>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              <Leitura
                rotulo="Aceita"
                valor={
                  vistoria.aceitaEm ? new Date(vistoria.aceitaEm).toLocaleString("pt-BR") : "—"
                }
              />
              <Leitura
                rotulo="Deslocamento"
                valor={
                  vistoria.iniciadaEm ? new Date(vistoria.iniciadaEm).toLocaleString("pt-BR") : "—"
                }
              />
              <Leitura
                rotulo="Chegada"
                valor={
                  vistoria.chegadaEm ? new Date(vistoria.chegadaEm).toLocaleString("pt-BR") : "—"
                }
              />
              <Leitura
                rotulo="Termo aceito"
                valor={
                  vistoria.termoAceitoEm
                    ? new Date(vistoria.termoAceitoEm).toLocaleString("pt-BR")
                    : vistoria.termoAceito
                      ? "Sim"
                      : "—"
                }
              />
            </div>
          </Secao>

          <Secao titulo="Checklist da vistoria">
            {itens.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                O checklist é preenchido pelo agente durante a execução em campo.
              </p>
            ) : (
              <ul className="grid gap-px bg-border">
                {itens.map((item) => {
                  const daAvaria = avarias.filter((a) => a.itemId === item.id);
                  return (
                    <li key={item.id} className="bg-surface px-3 py-2 text-[13px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{item.item}</span>
                        <Selo tom={TOM_CONDICAO[item.condicao]}>
                          {ROTULO_CONDICAO[item.condicao]}
                        </Selo>
                      </div>
                      {daAvaria.map((a) => (
                        <p key={a.id} className="mt-1 text-[12px] text-muted-foreground">
                          {a.descricao}
                          <span className="ml-2 font-mono text-[11px]">
                            {fotosDaAvaria(banco, a.id).length} foto(s)
                          </span>
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Fotos da vistoria (${evidencias.length})`} padding={false}>
            <div className="p-3">
              <GaleriaVistoria fotos={evidencias} />
            </div>
          </Secao>
        </div>

        <Secao titulo="Histórico">
          {historico.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <ol className="grid gap-3">
              {historico.map((h) => (
                <li key={h.id} className="border-l-2 border-l-border-strong pl-3">
                  <p className="text-[13px]">{h.acao}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {new Date(h.quando).toLocaleString("pt-BR")} · {h.quem}
                  </p>
                  {h.detalhe && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{h.detalhe}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Secao>
      </div>

      <Modal
        aberto={distribuindo}
        aoFechar={() => setDistribuindo(false)}
        titulo="Escolher agente"
        descricao="Use os agentes já cadastrados no sistema."
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setDistribuindo(false)}>
              Cancelar
            </Botao>
            <Botao onClick={distribuir}>Confirmar</Botao>
          </>
        }
      >
        <div className="p-4">
          <Selecao
            rotulo="Agente"
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
      {dialogo}
    </Pagina>
  );
}
