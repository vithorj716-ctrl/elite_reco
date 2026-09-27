/**
 * App do agente — Vistorias.
 *
 * Fluxo idêntico ao do recolhimento e travado passo a passo:
 * aceitar → iniciar deslocamento → anunciar chegada → fotos obrigatórias com
 * marca d'água → checklist item a item (com foto de avaria) → termo → concluir.
 * Sem chegada não há foto; sem foto e sem termo não há conclusão.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, ClipboardCheck, MapPin, Phone } from "lucide-react";
import { Botao, Metrica, Pagina, Secao, Selo, Vazio } from "@/components/app/ui";
import { BlocoRastreador } from "@/components/negocio/rastreador";
import { ExecucaoVistoria } from "@/components/negocio/execucao-vistoria";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { VistoriasService } from "@/services/vistorias.service";
import {
  motoDaVistoria,
  nomeLocadora,
  placaDaVistoria,
  precoPagamentoVistoria,
} from "@/domain/services/vistorias";
import { dinheiro } from "@/domain/services/financeiro";
import { ROTULO_STATUS_VISTORIA, type Vistoria } from "@/domain/types";

export const Route = createFileRoute("/_app/agente/vistorias")({
  head: () => ({
    meta: [
      { title: "Minhas vistorias — Recolhe" },
      {
        name: "description",
        content: "Vistorias atribuídas ao agente: checklist, fotos obrigatórias e conclusão.",
      },
      { property: "og:title", content: "Minhas vistorias — Recolhe" },
      {
        property: "og:description",
        content: "Execução das vistorias em campo, com registro fotográfico obrigatório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VistoriasDoAgente,
});

function VistoriasDoAgente() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const [emFoco, setEmFoco] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const minhas = useMemo(
    () =>
      banco.vistorias.filter(
        (v) =>
          v.agenteId === usuario?.agenteId && v.status !== "cancelada" && v.status !== "concluida",
      ),
    [banco.vistorias, usuario?.agenteId],
  );

  const concluidas = useMemo(
    () =>
      banco.vistorias.filter((v) => v.agenteId === usuario?.agenteId && v.status === "concluida"),
    [banco.vistorias, usuario?.agenteId],
  );

  const executar = async (acao: () => Promise<unknown>, sucesso: string, chaves: string[]) => {
    setOcupado(true);
    try {
      await acao();
      toast.success(sucesso);
      sincronizar(chaves as never);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pagina
      titulo="Minhas vistorias"
      descricao="Aceite, desloque-se, anuncie a chegada, fotografe e conclua. A conclusão agenda automaticamente a próxima vistoria da moto."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Em aberto" valor={minhas.length} destaque />
        <Metrica rotulo="Concluídas" valor={concluidas.length} />
        <Metrica
          rotulo="A receber por vistoria"
          valor={dinheiro(precoPagamentoVistoria(banco, usuario?.agenteId) ?? 0)}
        />
      </div>

      {minhas.length === 0 ? (
        <div className="mt-4">
          <Vazio
            icone={ClipboardCheck}
            titulo="Nenhuma vistoria atribuída"
            texto="Assim que a central distribuir uma vistoria, ela aparece aqui."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {minhas.map((v) => {
            const escolhida = emFoco === v.id;
            const moto = motoDaVistoria(banco, v);
            const emCampo = v.status === "em_andamento";
            const chegou = !!v.chegadaEm;
            const endereco =
              [v.endereco, v.bairro, v.cidade, v.uf].filter(Boolean).join(", ") ||
              "Endereço não informado";

            return (
              <Secao
                key={v.id}
                titulo={`${v.codigo} · ${placaDaVistoria(banco, v)}`}
                acao={<Selo tom="info">{ROTULO_STATUS_VISTORIA[v.status]}</Selo>}
              >
                <p className="text-[13px] text-muted-foreground">
                  {nomeLocadora(banco, v.locadoraId)} ·{" "}
                  {[moto?.marca, moto?.modelo, moto?.cor].filter(Boolean).join(" ") || "moto"}
                </p>

                <div className="mt-3 grid gap-1.5 text-[13px]">
                  <p className="flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span>
                      {endereco}
                      {v.cep && <span className="text-muted-foreground"> · CEP {v.cep}</span>}
                    </span>
                  </p>
                  {v.contatoNome || v.contatoTelefone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span>
                        {v.contatoNome || "Contato"}
                        {v.contatoTelefone && (
                          <a
                            href={`tel:${v.contatoTelefone.replace(/\D/g, "")}`}
                            className="ml-2 text-primary hover:underline"
                          >
                            {v.contatoTelefone}
                          </a>
                        )}
                      </span>
                    </p>
                  ) : null}
                  <BlocoRastreador
                    dados={{
                      host: moto?.host || v.host,
                      pin: moto?.pin || v.pin,
                    }}
                    bloqueado={!v.iniciadaEm}
                    compacto
                  />
                  {v.linkMaps && (
                    <a
                      href={v.linkMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-primary hover:underline"
                    >
                      Abrir rota no mapa
                    </a>
                  )}
                  {v.observacoes && (
                    <p className="text-[12px] text-muted-foreground">Obs.: {v.observacoes}</p>
                  )}
                </div>

                {/* Passo a passo obrigatório */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {v.status === "distribuida" && !v.aceitaEm && (
                    <Botao
                      onClick={() =>
                        executar(() => VistoriasService.aceitar(v.id), "Vistoria aceita.", [
                          "vistorias",
                        ])
                      }
                      carregando={ocupado}
                    >
                      Aceitar vistoria
                    </Botao>
                  )}
                  {v.status === "distribuida" && v.aceitaEm && (
                    <Botao
                      onClick={() =>
                        executar(() => VistoriasService.iniciar(v.id), "Deslocamento iniciado.", [
                          "vistorias",
                        ])
                      }
                      carregando={ocupado}
                    >
                      Iniciar deslocamento
                    </Botao>
                  )}
                  {emCampo && !chegou && (
                    <Botao
                      onClick={() =>
                        executar(
                          () => VistoriasService.registrarChegada(v.id),
                          "Chegada registrada.",
                          ["vistorias"],
                        )
                      }
                      carregando={ocupado}
                    >
                      Cheguei ao local
                    </Botao>
                  )}
                  {emCampo && chegou && (
                    <Botao variante="linha" onClick={() => setEmFoco(escolhida ? null : v.id)}>
                      {escolhida ? "Fechar execução" : "Executar vistoria"}
                    </Botao>
                  )}
                </div>

                {!chegou && emCampo && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Registre a chegada para liberar as fotos e o checklist.
                  </p>
                )}

                {escolhida && emCampo && chegou && (
                  <div className="mt-4">
                    <ExecucaoVistoria vistoria={v} aoConcluir={() => setEmFoco(null)} />
                  </div>
                )}
              </Secao>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
