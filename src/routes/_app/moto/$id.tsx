/**
 * Ficha da motocicleta — visão completa para a locadora e para a central.
 *
 * Nada aqui é novo dado: a moto, as vistorias, os recolhimentos, o checklist,
 * as avarias e as fotos já existem no sistema. Esta tela apenas reúne tudo em
 * uma linha do tempo navegável. O RLS garante que cada locadora só enxergue a
 * própria frota.
 */
import { createFileRoute, Link, useParams, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Gauge } from "lucide-react";
import { Abas, Botao, Metrica, Pagina, Secao, Selo, Status, Vazio } from "@/components/app/ui";
import { Leitura } from "@/components/negocio/formulario";
import { BlocoRastreador } from "@/components/negocio/rastreador";
import { GaleriaFotos, PainelEvidencias } from "@/components/negocio/evidencias";
import { GaleriaVistoria } from "@/components/negocio/galeria-vistoria";
import { useBanco } from "@/lib/sessao";
import {
  ROTULO_PRAZO,
  TOM_PRAZO,
  avariasDaVistoria,
  diasRestantes,
  fotosDaAvaria,
  fotosDaVistoria,
  historicoDaMoto,
  itensDaVistoria,
  nomeAgente,
  statusPrazo,
} from "@/domain/services/vistorias";
import {
  ROTULO_CONDICAO,
  ROTULO_SITUACAO_MOTO,
  ROTULO_STATUS_VISTORIA,
  TOM_CONDICAO,
  type Vistoria,
} from "@/domain/types";

export const Route = createFileRoute("/_app/moto/$id")({
  head: () => ({
    meta: [
      { title: "Ficha da motocicleta — Recolhe" },
      {
        name: "description",
        content:
          "Dados cadastrais, histórico de vistorias e recolhimentos, checklist, avarias e fotos de uma motocicleta.",
      },
      { property: "og:title", content: "Ficha da motocicleta — Recolhe" },
      {
        property: "og:description",
        content: "Tudo sobre a moto: prazo de vistoria, evidências, laudos e recolhimentos.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (
    busca: Record<string, unknown>,
  ): { aba?: "vistorias" | "recolhimentos" | "historico" } => {
    const valor = busca["aba"];
    return valor === "vistorias" || valor === "recolhimentos" || valor === "historico"
      ? { aba: valor }
      : {};
  },
  component: FichaMoto,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-[13px] text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-[13px]">Motocicleta não encontrada.</div>,
});

const data = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const kmTexto = (km?: number | null) =>
  km === undefined || km === null ? "—" : `${km.toLocaleString("pt-BR")} km`;

function FichaMoto() {
  const { id } = useParams({ from: "/_app/moto/$id" });
  const banco = useBanco();
  const [expandida, setExpandida] = useState<string | null>(null);
  const navegar = useNavigate({ from: "/moto/$id" });
  const roteador = useRouter();
  const { aba = "vistorias" } = Route.useSearch();
  const setAba = (valor: "vistorias" | "recolhimentos" | "historico") =>
    void navegar({ search: { aba: valor }, replace: true });
  const voltar = () => {
    if (roteador.history.canGoBack()) roteador.history.back();
    else void navegar({ to: "/portal", search: { aba: "motocicletas" } });
  };

  const moto = banco.motos.find((m) => m.id === id) ?? null;
  const vistorias = useMemo(() => (moto ? historicoDaMoto(banco, moto.id) : []), [banco, moto]);
  const recolhimentos = useMemo(
    () =>
      moto
        ? banco.ordens
            .filter((o) => o.locadoraId === moto.locadoraId && o.placa === moto.placa)
            .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
        : [],
    [banco.ordens, moto],
  );

  if (!moto) {
    return (
      <Pagina titulo="Motocicleta" descricao="Registro não encontrado.">
        <Vazio
          titulo="Motocicleta não encontrada"
          texto="Ela pode ter sido removida ou pertence a outra locadora."
        />
      </Pagina>
    );
  }

  const prazo = statusPrazo(moto);
  const dias = diasRestantes(moto);
  const ultimaConcluida = vistorias.find((v) => v.status === "concluida");

  return (
    <Pagina
      titulo={`Moto ${moto.placa}`}
      descricao={`${moto.marca} ${moto.modelo} · ${ROTULO_SITUACAO_MOTO[moto.situacao]}`}
      acoes={
        <Botao variante="fantasma" onClick={voltar}>
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar
        </Botao>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Prazo de vistoria"
          valor={ROTULO_PRAZO[prazo]}
          nota={dias === null ? "sem vistoria registrada" : `${dias} dia(s)`}
          destaque
        />
        <Metrica rotulo="Última vistoria" valor={data(moto.ultimaVistoriaEm)} />
        <Metrica
          rotulo="KM registrado"
          valor={kmTexto(ultimaConcluida?.km ?? null)}
          nota="lido no painel na última vistoria"
        />
        <Metrica
          rotulo="Histórico"
          valor={`${vistorias.length} / ${recolhimentos.length}`}
          nota="vistorias / recolhimentos"
        />
      </div>

      <div className="mt-5 grid gap-4">
        <Secao titulo="Dados da motocicleta" padding={false}>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            <Leitura rotulo="Placa" valor={moto.placa} />
            <Leitura rotulo="Marca" valor={moto.marca} />
            <Leitura rotulo="Modelo" valor={moto.modelo} />
            <Leitura rotulo="Ano" valor={moto.ano} />
            <Leitura rotulo="Cor" valor={moto.cor} />
            <Leitura rotulo="Chassi" valor={moto.chassi} />
            <Leitura rotulo="Situação" valor={ROTULO_SITUACAO_MOTO[moto.situacao]} />
            <Leitura rotulo="Cadastrada em" valor={data(moto.criadaEm)} />
            <Leitura rotulo="Próxima vistoria" valor={data(moto.proximaVistoriaEm)} />
            <Leitura rotulo="Observações" valor={moto.observacoes} />
          </div>
        </Secao>

        <Secao titulo="Rastreador" padding={false}>
          <BlocoRastreador className="border-0" dados={{ host: moto.host, pin: moto.pin }} />
        </Secao>

        <Abas
          id="abas-moto"
          valor={aba}
          aoTrocar={(v) => {
            setAba(v);
            setExpandida(null);
          }}
          itens={[
            { valor: "vistorias" as const, rotulo: "Vistorias", contador: vistorias.length },
            { valor: "recolhimentos", rotulo: "Recolhimentos", contador: recolhimentos.length },
            { valor: "historico", rotulo: "Histórico geral" },
          ]}
        />

        {aba === "vistorias" && (
          <Secao
            titulo={`Vistorias (${vistorias.length})`}
          >
            <p className="mb-3 text-[12px] text-muted-foreground">
              Cada vistoria possui checklist, avarias e fotos próprias — nada é compartilhado com os
              recolhimentos.
            </p>
            {vistorias.length === 0 ? (
              <Vazio
                compacto
                titulo="Nenhuma vistoria"
                texto="Assim que a central executar a primeira vistoria ela aparece aqui."
              />
            ) : (
              <ul className="grid gap-px bg-border">
                {vistorias.map((v) => (
                  <BlocoVistoria
                    key={v.id}
                    vistoria={v}
                    aberta={expandida === v.id}
                    aoAlternar={() => setExpandida((a) => (a === v.id ? null : v.id))}
                  />
                ))}
              </ul>
            )}
          </Secao>
        )}

        {aba === "recolhimentos" && (
          <Secao
            titulo={`Recolhimentos (${recolhimentos.length})`}
          >
            <p className="mb-3 text-[12px] text-muted-foreground">
              Cada ordem exibe somente as evidências capturadas naquele recolhimento.
            </p>
            {recolhimentos.length === 0 ? (
              <Vazio
                compacto
                titulo="Nenhum recolhimento"
                texto="Esta motocicleta não possui ordens de recolhimento."
              />
            ) : (
              <ul className="grid gap-px bg-border">
                {recolhimentos.map((o) => (
                  <BlocoRecolhimento
                    key={o.id}
                    ordem={o}
                    aberta={expandida === o.id}
                    aoAlternar={() => setExpandida((a) => (a === o.id ? null : o.id))}
                  />
                ))}
              </ul>
            )}
          </Secao>
        )}

        {aba === "historico" && (
          <Secao
            titulo="Linha do tempo"
          >
            <p className="mb-3 text-[12px] text-muted-foreground">
              Eventos em ordem cronológica, sempre identificados por tipo de operação.
            </p>
            <LinhaTempo vistorias={vistorias} recolhimentos={recolhimentos} />
          </Secao>
        )}
      </div>


      <Selo tom={TOM_PRAZO[prazo]} className="sr-only">
        {ROTULO_PRAZO[prazo]}
      </Selo>

    </Pagina>
  );
}

function BlocoVistoria({
  vistoria,
  aberta,
  aoAlternar,
}: {
  vistoria: Vistoria;
  aberta: boolean;
  aoAlternar: () => void;
}) {
  const banco = useBanco();
  const itens = itensDaVistoria(banco, vistoria.id);
  const avarias = avariasDaVistoria(banco, vistoria.id);
  const fotos = fotosDaVistoria(banco, vistoria.id);

  return (
    <li className="bg-surface">
      <button
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="press flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-[13px] hover:bg-surface-raised"
      >
        <span className="font-mono text-primary">{vistoria.codigo}</span>
        <span className="text-muted-foreground">
          {dataHora(vistoria.concluidaEm ?? vistoria.solicitadaEm)}
        </span>
        <span className="text-muted-foreground">{nomeAgente(banco, vistoria.agenteId ?? null)}</span>
        <span className="flex items-center gap-1 font-mono text-[12px] text-foreground">
          <Gauge className="size-3.5" aria-hidden /> {kmTexto(vistoria.km)}
        </span>
        <Selo tom={vistoria.status === "concluida" ? "sucesso" : "neutro"}>
          {ROTULO_STATUS_VISTORIA[vistoria.status]}
        </Selo>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {aberta ? "ocultar" : "ver detalhes"}
        </span>
      </button>

      {aberta && (
        <div className="border-t border-border px-3 py-3">
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Leitura rotulo="Quilometragem" valor={kmTexto(vistoria.km)} />
            <Leitura
              rotulo="GPS"
              valor={vistoria.latitude ? `${vistoria.latitude}, ${vistoria.longitude}` : "—"}
            />
            <Leitura rotulo="Chegada" valor={dataHora(vistoria.chegadaEm)} />
            <Leitura rotulo="Conclusão" valor={dataHora(vistoria.concluidaEm)} />
          </div>

          {vistoria.observacoes && (
            <p className="mt-3 text-[13px] text-muted-foreground">{vistoria.observacoes}</p>
          )}

          <p className="label-caps mt-4">Checklist</p>
          {itens.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted-foreground">Checklist ainda não preenchido.</p>
          ) : (
            <ul className="mt-2 grid gap-px bg-border">
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
                    {daAvaria.map((a) => {
                      const provas = fotosDaAvaria(banco, a.id);
                      return (
                        <div key={a.id} className="mt-1">
                          <span className="text-[12px] text-muted-foreground">{a.descricao}</span>
                          {provas.length > 0 && (
                            <div className="mt-1.5">
                              <GaleriaVistoria fotos={provas} compacta />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="label-caps mt-4">Fotos ({fotos.length})</p>
          <div className="mt-2">
            <GaleriaVistoria fotos={fotos} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/vistorias/$id" params={{ id: vistoria.id }}>
              <Botao variante="fantasma" tamanho="sm">
                Abrir vistoria completa
              </Botao>
            </Link>
            <Link
              to="/documentos/$tipo/$id"
              params={{ tipo: "laudo-vistoria", id: vistoria.id }}
            >
              <Botao variante="linha" tamanho="sm">
                <FileText className="size-3.5" aria-hidden /> Baixar laudo da vistoria
              </Botao>
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

/** Eventos reais da moto — vistorias e recolhimentos em ordem cronológica. */
/**
 * Recolhimento — dados da captura e evidências exclusivas desta ordem.
 * As fotos vêm de `ordem_evidencias`/`ordem_fotos` filtradas pelo id da ordem,
 * portanto nunca se misturam com as fotos de uma vistoria da mesma moto.
 */
function BlocoRecolhimento({
  ordem,
  aberta,
  aoAlternar,
}: {
  ordem: import("@/domain/types").Ordem;
  aberta: boolean;
  aoAlternar: () => void;
}) {
  const banco = useBanco();

  return (
    <li className="bg-surface">
      <button
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="press flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-[13px] hover:bg-surface-raised"
      >
        <span className="font-mono text-primary">{ordem.codigo}</span>
        <span className="text-muted-foreground">{data(ordem.criadaEm)}</span>
        <span className="text-muted-foreground">{nomeAgente(banco, ordem.agenteId ?? null)}</span>
        <Status valor={ordem.status} />
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {aberta ? "ocultar" : "ver detalhes"}
        </span>
      </button>

      {aberta && (
        <div className="border-t border-border px-3 py-3">
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Leitura rotulo="Agente principal" valor={nomeAgente(banco, ordem.agenteId ?? null)} />
            <Leitura
              rotulo="Agente auxiliar"
              valor={ordem.agenteAuxiliarId ? nomeAgente(banco, ordem.agenteAuxiliarId) : "—"}
            />
            <Leitura rotulo="Iniciado em" valor={dataHora(ordem.iniciadaEm)} />
            <Leitura rotulo="Concluído em" valor={dataHora(ordem.concluidaEm)} />
            <Leitura
              rotulo="Local da captura"
              valor={[ordem.endereco, ordem.bairro, ordem.cidade, ordem.uf]
                .filter(Boolean)
                .join(", ")}
            />
            <Leitura
              rotulo="GPS"
              valor={ordem.latitude ? `${ordem.latitude}, ${ordem.longitude}` : "—"}
            />
            <Leitura rotulo="KM percorrido" valor={kmTexto(ordem.quantidadeKm ?? null)} />
            <Leitura rotulo="Observações" valor={ordem.observacoes ?? "—"} />
          </div>

          <p className="label-caps mt-4">Evidências deste recolhimento</p>
          <div className="mt-2 grid gap-3">
            <PainelEvidencias ordem={ordem} />
            <GaleriaFotos ordem={ordem} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/ordens/$id" params={{ id: ordem.id }}>
              <Botao variante="fantasma" tamanho="sm">
                Abrir recolhimento completo
              </Botao>
            </Link>
            {ordem.status === "concluida" && (
              <Link to="/documentos/$tipo/$id" params={{ tipo: "laudo", id: ordem.id }}>
                <Botao variante="linha" tamanho="sm">
                  <FileText className="size-3.5" aria-hidden /> Laudo do recolhimento
                </Botao>
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function LinhaTempo({

  vistorias,
  recolhimentos,
}: {
  vistorias: Vistoria[];
  recolhimentos: import("@/domain/types").Ordem[];
}) {
  const banco = useBanco();
  const eventos: Array<{
    id: string;
    quando: string;
    titulo: string;
    detalhe: string;
    para: "vistoria" | "ordem";
    alvo: string;
  }> = [];

  for (const v of vistorias) {
    eventos.push({
      id: `v-sol-${v.id}`,
      quando: v.solicitadaEm,
      titulo: "Vistoria solicitada",
      detalhe: v.codigo,
      para: "vistoria",
      alvo: v.id,
    });
    if (v.concluidaEm) {
      eventos.push({
        id: `v-con-${v.id}`,
        quando: v.concluidaEm,
        titulo: "Vistoria realizada",
        detalhe: `${nomeAgente(banco, v.agenteId ?? null)} · ${kmTexto(v.km)}`,
        para: "vistoria",
        alvo: v.id,
      });
    }
  }
  for (const o of recolhimentos) {
    eventos.push({
      id: `o-sol-${o.id}`,
      quando: o.criadaEm,
      titulo: "Recolhimento solicitado",
      detalhe: o.codigo,
      para: "ordem",
      alvo: o.id,
    });
    if (o.concluidaEm) {
      eventos.push({
        id: `o-con-${o.id}`,
        quando: o.concluidaEm,
        titulo: "Recolhimento concluído",
        detalhe: nomeAgente(banco, o.agenteId ?? null),
        para: "ordem",
        alvo: o.id,
      });
    }
  }

  eventos.sort((a, b) => b.quando.localeCompare(a.quando));

  if (eventos.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Nenhum evento registrado.</p>;
  }

  return (
    <ol className="grid gap-3">
      {eventos.map((e) => (
        <li key={e.id} className="border-l-2 border-l-border-strong pl-3">
          <p className="font-mono text-[11px] text-muted-foreground">{dataHora(e.quando)}</p>
          <p className="text-[13px]">{e.titulo}</p>
          <p className="text-[12px] text-muted-foreground">{e.detalhe}</p>
          {e.para === "vistoria" ? (
            <Link
              to="/vistorias/$id"
              params={{ id: e.alvo }}
              className="press mt-1 inline-block text-[12px] text-primary hover:underline"
            >
              Ver vistoria
            </Link>
          ) : (
            <Link
              to="/ordens/$id"
              params={{ id: e.alvo }}
              className="press mt-1 inline-block text-[12px] text-primary hover:underline"
            >
              Ver recolhimento
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
