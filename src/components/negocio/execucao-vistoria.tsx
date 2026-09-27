/**
 * Execução da vistoria em campo.
 *
 * Um único painel, na ordem real da operação: quilometragem → fotos com marca
 * d'água → checklist item a item → avarias com foto → revisão → termo →
 * conclusão. Nada é liberado fora de ordem e a lista de pendências mostra, a
 * qualquer momento, exatamente o que ainda falta.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, Check, Gauge, MapPin, RefreshCw, X } from "lucide-react";
import { Botao, Selo } from "@/components/app/ui";
import { useConfirmacao } from "@/components/app/confirmar";
import { AreaTexto, Entrada } from "@/components/negocio/formulario";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";

import { VistoriasService } from "@/services/vistorias.service";
import {
  avariasDaVistoria,
  catalogoAtivo,
  fotosDaAvaria,
  fotosDaVistoria,
  itensDaVistoria,
  nomeLocadora,
  pendenciasDaVistoria,
  placaDaVistoria,
  precoCobrancaVistoria,
  precoPagamentoVistoria,
  resumoInspecao,
  tabelaCobrancaVistoria,
  tabelaPagamentoVistoria,
} from "@/domain/services/vistorias";
import {
  FOTOS_VISTORIA,
  ROTULO_CONDICAO,
  TERMO_VISTORIA,
  TOM_CONDICAO,
  type CategoriaFoto,
  type CondicaoItem,
  type ItemVistoria,
  type Vistoria,
} from "@/domain/types";

const CONDICOES: CondicaoItem[] = ["bom", "regular", "ruim"];

interface Props {
  vistoria: Vistoria;
  aoConcluir?: () => void;
}

export function ExecucaoVistoria({ vistoria, aoConcluir }: Props) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const confirmacao = useConfirmacao();
  const [ocupado, setOcupado] = useState(false);
  /** Estado de envio por etapa: enviando ou erro. Salvo = registro no banco. */
  const [envios, setEnvios] = useState<
    Record<string, { estado: "enviando" | "erro"; erro?: string }>
  >({});
  const [km, setKm] = useState(
    vistoria.km === undefined || vistoria.km === null ? "" : String(vistoria.km),
  );

  const [observacoes, setObservacoes] = useState(vistoria.observacoes);
  const [termo, setTermo] = useState(vistoria.termoAceito);
  const [preparado, setPreparado] = useState("");

  const itens = itensDaVistoria(banco, vistoria.id);
  const avarias = avariasDaVistoria(banco, vistoria.id);
  const fotos = fotosDaVistoria(banco, vistoria.id);
  const catalogo = useMemo(() => catalogoAtivo(banco), [banco]);
  const resumo = resumoInspecao(banco, vistoria.id);
  // ── Quilometragem: uma única fonte de verdade ──
  // O valor persistido manda; o que está digitado só vale depois de gravado.
  const kmDigitado = Number(km.replace(/\D/g, ""));
  const kmValido = Number.isFinite(kmDigitado) && kmDigitado > 0;
  const kmPersistido = vistoria.km === undefined || vistoria.km === null ? null : vistoria.km;
  const kmRegistrado = kmPersistido !== null;
  const kmEfetivo = kmValido ? kmDigitado : kmPersistido;
  const kmPendente = kmValido && kmDigitado !== kmPersistido;

    // Pendências considerando o KM que será gravado na conclusão.
  const pendenciasReais = pendenciasDaVistoria(
    banco,
    { ...vistoria, termoAceito: termo, km: kmEfetivo ?? undefined },
    FOTOS_VISTORIA,
  ).filter((p) => p.chave !== "km" || kmEfetivo === null);

  // ── Fotos obrigatórias: apenas o registro persistido conta como salva ──
  const fotoSalva = (etapa: string) =>
    fotos.some((e) => e.etapa === etapa && !e.avariaId && Boolean(e.caminho));
  const salvas = FOTOS_VISTORIA.filter((f) => fotoSalva(f.etapa)).length;
  const enviando = Object.values(envios).some((e) => e.estado === "enviando");
  const comErro = Object.entries(envios).filter(([, e]) => e.estado === "erro");
  const fotosCompletas = salvas === FOTOS_VISTORIA.length && !enviando && comErro.length === 0;




  // O checklist da vistoria nasce do catálogo administrável e é completado
  // sempre que a central cria um item novo. Sem isso o banco recusa a conclusão
  // por um item obrigatório que nunca apareceu na tela do agente.
  const faltandoNoChecklist = useMemo(
    () => catalogo.filter((c) => !itens.some((i) => i.codigo === c.codigo)),
    [catalogo, itens],
  );
  const assinatura = faltandoNoChecklist.map((c) => c.codigo).join(",");

  useEffect(() => {
    if (!assinatura || preparado === assinatura) return;
    setPreparado(assinatura);
    VistoriasService.prepararChecklist(vistoria.id, catalogo, itens)
      .then((criados) => criados.length > 0 && sincronizar(["vistoria_itens"] as never))
      .catch((e: Error) => toast.error(e.message));
  }, [assinatura, preparado, catalogo, itens, vistoria.id, sincronizar]);


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

  /**
   * Garante que o KM digitado esteja realmente persistido antes de qualquer
   * passo seguinte. Devolve sempre o valor gravado no banco.
   */
  const garantirKm = async (): Promise<number> => {
    if (!kmValido && kmPersistido === null) {
      throw new Error("Informe a quilometragem lida no painel.");
    }
    const valor = kmValido ? kmDigitado : kmPersistido!;
    if (valor !== kmPersistido) {
      await VistoriasService.registrarKm(vistoria.id, valor);
      sincronizar(["vistorias"] as never);
    }
    return valor;
  };

  const salvarKm = async () => {
    setOcupado(true);
    try {
      const valor = await garantirKm();
      setKm(String(valor));
      toast.success("Quilometragem e localização registradas.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Envio de uma foto com estado próprio: enviando → salva ou erro.
   * A foto só conta como entregue depois que o serviço confirma arquivo +
   * registro no banco + arquivo recuperável.
   */
  const enviarFoto = async (
    etapa: string,
    categoria: CategoriaFoto,
    arquivo: File | undefined,
    avariaId?: string,
  ) => {
    if (!arquivo) return;
    let valorKm: number;
    try {
      valorKm = await garantirKm();
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setEnvios((atual) => ({ ...atual, [etapa]: { estado: "enviando" } }));
    try {
      await VistoriasService.anexarFoto({ ...vistoria, km: valorKm }, arquivo, {
        etapa,
        categoria,
        km: valorKm,
        avariaId: avariaId ?? null,
        placa: placaDaVistoria(banco, vistoria),
        agente: usuario?.nome ?? "Agente",
        locadora: nomeLocadora(banco, vistoria.locadoraId),
      });
      setEnvios((atual) => {
        const copia = { ...atual };
        delete copia[etapa];
        return copia;
      });
      toast.success("Foto salva com marca d'água.");
      sincronizar(["vistoria_evidencias"] as never);
    } catch (e) {
      const erro = (e as Error).message;
      setEnvios((atual) => ({ ...atual, [etapa]: { estado: "erro", erro } }));
      toast.error(`Foto não enviada: ${erro}`);
    }
  };

  const avaliar = (item: ItemVistoria, condicao: CondicaoItem) =>
    executar(() => VistoriasService.avaliarItem(item.id, condicao), "Item avaliado.", [
      "vistoria_itens",
    ]);

  const concluir = async () => {
    setOcupado(true);
    try {
      // A quilometragem é persistida antes de qualquer validação de conclusão.
      await garantirKm();
      if (enviando) {
        toast.error("Existem fotos sendo enviadas. Aguarde o término dos uploads.");
        return;
      }
      if (comErro.length > 0) {
        toast.error("Existem fotos que não foram enviadas. Revise e tente novamente.");
        return;
      }
      if (pendenciasReais.length > 0) {
        toast.error(pendenciasReais[0]!.texto);
        return;
      }

      // Verdade final: as pendências vêm do banco, não da tela.
      const bloqueios = await VistoriasService.bloqueiosConclusao(vistoria.id);
      const restantes = bloqueios.filter((b) => b.chave !== "chegada" || !vistoria.chegadaEm);
      if (restantes.length > 0) {
        toast.error(`Não é possível finalizar a vistoria. ${restantes[0]!.texto}.`);
        return;
      }

      const ok = await confirmacao.pedir({
        titulo: "Concluir vistoria",
        texto:
          "Todas as informações e fotos obrigatórias foram salvas. Deseja concluir a vistoria?",
        confirmar: "Concluir vistoria",
      });
      if (!ok) return;

      if (observacoes !== vistoria.observacoes) {
        await VistoriasService.salvarObservacoes(vistoria.id, observacoes);
      }
      if (!vistoria.termoAceito) await VistoriasService.aceitarTermo(vistoria.id);
      await VistoriasService.concluir(vistoria.id, {
        observacoes,
        valorCobranca: precoCobrancaVistoria(banco, vistoria.locadoraId),
        valorPagamento: precoPagamentoVistoria(banco, vistoria.agenteId),
        tabelaCobrancaId: tabelaCobrancaVistoria(banco, vistoria.locadoraId)?.id ?? null,
        tabelaPagamentoId: tabelaPagamentoVistoria(banco, vistoria.agenteId)?.id ?? null,
      });
      toast.success("Vistoria concluída com sucesso. Próxima em 40 dias.");
      sincronizar(["vistorias", "motos", "vistoria_evidencias"] as never);
      aoConcluir?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };



  return (
    <div className="grid gap-5">
      {/* 1 — Quilometragem e localização */}
      <section>
        <Titulo
          numero={1}
          texto="Quilometragem e localização"
          pronto={kmRegistrado && !kmPendente}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Entrada
            rotulo="KM do painel"
            inputMode="numeric"
            value={km}
            areaClassName="w-40"
            onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              if (kmPendente) void salvarKm();
            }}
          />
          <Botao variante="linha" onClick={salvarKm} carregando={ocupado}>
            <Gauge className="size-3.5" aria-hidden /> Registrar
          </Botao>
          {kmRegistrado && (
            <span className="pb-2 font-mono text-[12px] text-muted-foreground">
              gravado: {kmPersistido!.toLocaleString("pt-BR")} km
            </span>
          )}
          {kmPendente && (
            <span className="pb-2 text-[12px] text-warning">valor ainda não gravado</span>
          )}
          {vistoria.latitude && (
            <span className="flex items-center gap-1 pb-2 text-[12px] text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {vistoria.latitude}, {vistoria.longitude}
            </span>
          )}
        </div>

      </section>

      {/* 2 — Fotos obrigatórias */}
      <section>
        <Titulo numero={2} texto="Fotos da motocicleta" pronto={fotosCompletas} />
        <p className="mb-2 text-[12px] text-muted-foreground">
          {salvas} de {FOTOS_VISTORIA.length} fotos obrigatórias salvas no servidor.
          {enviando && " Enviando…"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FOTOS_VISTORIA.map((f) => {
            const envio = envios[f.etapa];
            const feita = fotoSalva(f.etapa);
            const enviandoEsta = envio?.estado === "enviando";
            const falhou = envio?.estado === "erro";
            const borda = falhou
              ? "border-destructive/60 text-destructive"
              : feita
                ? "border-success/60 text-success"
                : enviandoEsta
                  ? "border-primary/60 text-primary"
                  : "border-border hover:border-border-strong";
            return (
              <label
                key={f.etapa}
                title={envio?.erro ?? ""}
                className={`press flex cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-[12px] ${borda}`}
              >
                <span className="flex items-center gap-2">
                  <Camera className="size-3.5" aria-hidden /> {f.rotulo}
                </span>
                <span className="flex items-center gap-1">
                  {falhou && <X className="size-3.5" aria-hidden />}
                  {falhou && "falhou — toque para reenviar"}
                  {!falhou && enviandoEsta && <RefreshCw className="size-3.5 animate-spin" aria-hidden />}
                  {!falhou && enviandoEsta && "enviando"}
                  {!falhou && !enviandoEsta && (feita ? "salva" : "pendente")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={enviandoEsta || (!kmRegistrado && !kmValido)}
                  onChange={(e) => enviarFoto(f.etapa, f.categoria, e.target.files?.[0])}
                />
              </label>
            );
          })}
        </div>
        {comErro.length > 0 && (
          <p className="mt-2 text-[12px] text-destructive">
            {comErro.length} foto(s) não foram salvas. A vistoria não pode ser concluída até que
            todas estejam no servidor.
          </p>
        )}
      </section>


      {/* 3 — Checklist item a item */}
      <section>
        <Titulo
          numero={3}
          texto="Checklist"
          pronto={itens.length > 0 && itens.every((i) => i.condicao !== "nao_avaliado")}
        />
        {itens.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Nenhum item ativo no catálogo de checklist. Fale com a central.
          </p>
        ) : (
          <ul className="grid gap-px bg-border">
            {itens.map((item) => (
              <ItemLinha
                key={item.id}
                item={item}
                avarias={avarias.filter((a) => a.itemId === item.id)}
                temFoto={(avariaId) => fotosDaAvaria(banco, avariaId).length > 0}
                ocupado={ocupado}
                aoAvaliar={(c) => avaliar(item, c)}
                aoRegistrarAvaria={(descricao) =>
                  executar(
                    () =>
                      VistoriasService.registrarAvaria({
                        vistoriaId: vistoria.id,
                        itemId: item.id,
                        componente: item.item,
                        condicao: item.condicao === "regular" ? "regular" : "ruim",
                        descricao,
                      }),
                    "Avaria registrada.",
                    ["vistoria_avarias"],
                  )
                }
                aoRemoverAvaria={(id) =>
                  executar(() => VistoriasService.removerAvaria(id), "Avaria removida.", [
                    "vistoria_avarias",
                  ])
                }
                aoFotografar={(avariaId, arquivo) =>
                  enviarFoto(`avaria-${item.codigo}`, "avaria", arquivo, avariaId)
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* 4 — Revisão e conclusão */}
      <section>
        <Titulo numero={4} texto="Revisão e conclusão" pronto={pendenciasReais.length === 0} />
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <Selo tom="sucesso">{resumo.bons} bom</Selo>
          <Selo tom="alerta">{resumo.regulares} regular</Selo>
          <Selo tom="perigo">{resumo.ruins} ruim</Selo>
          <Selo tom="neutro">{resumo.naoAvaliados} não avaliado</Selo>
          <Selo tom="info">
            {resumo.fotos} foto(s) · {resumo.avarias} avaria(s)
          </Selo>
        </div>

        <AreaTexto
          rotulo="Observações gerais"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />

        <label className="mt-3 flex items-start gap-2 border border-border p-3 text-[12px]">
          <input
            type="checkbox"
            checked={termo}
            onChange={(e) => setTermo(e.target.checked)}
            className="mt-0.5 size-3.5 accent-[hsl(var(--primary))]"
          />
          <span>{TERMO_VISTORIA}</span>
        </label>

        {pendenciasReais.length > 0 && (
          <ul className="mt-3 grid gap-1 border border-warning/40 bg-warning/[0.06] p-3 text-[12px]">
            {pendenciasReais.map((p) => (
              <li key={p.chave} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                {p.texto}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <Botao
            onClick={concluir}
            carregando={ocupado}
            disabled={pendenciasReais.length > 0 || !fotosCompletas}
          >
            Concluir vistoria
          </Botao>
        </div>
      </section>
      {confirmacao.dialogo}
    </div>
  );

}

function Titulo({ numero, texto, pronto }: { numero: number; texto: string; pronto: boolean }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      <span
        className={`flex size-4 items-center justify-center border text-[10px] ${
          pronto ? "border-success text-success" : "border-border"
        }`}
      >
        {pronto ? <Check className="size-2.5" aria-hidden /> : numero}
      </span>
      {texto}
    </h3>
  );
}

interface LinhaProps {
  item: ItemVistoria;
  avarias: import("@/domain/types").AvariaVistoria[];
  temFoto: (avariaId: string) => boolean;
  ocupado: boolean;
  aoAvaliar: (c: CondicaoItem) => void;
  aoRegistrarAvaria: (descricao: string) => void;
  aoRemoverAvaria: (id: string) => void;
  aoFotografar: (avariaId: string, arquivo: File | undefined) => void;
}

function ItemLinha({
  item,
  avarias,
  temFoto,
  ocupado,
  aoAvaliar,
  aoRegistrarAvaria,
  aoRemoverAvaria,
  aoFotografar,
}: LinhaProps) {
  const [descricao, setDescricao] = useState("");
  const exigeAvaria = item.condicao === "ruim";

  return (
    <li className="bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px]">
          {item.item}
          {item.obrigatorio && <span className="ml-1 text-destructive">*</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {CONDICOES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={ocupado}
              onClick={() => aoAvaliar(c)}
              className={`press border px-2 py-1 text-[11px] ${
                item.condicao === c
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {ROTULO_CONDICAO[c]}
            </button>
          ))}
        </div>
      </div>

      {item.condicao !== "nao_avaliado" && item.condicao !== "bom" && (
        <div className="mt-2 grid gap-2 border-l-2 border-l-warning/60 pl-3">
          {avarias.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">{a.descricao}</span>
              <div className="flex items-center gap-1.5">
                <label
                  className={`press cursor-pointer border px-2 py-1 text-[11px] ${
                    temFoto(a.id) ? "border-success/60 text-success" : "border-border"
                  }`}
                >
                  {temFoto(a.id) ? "foto ok" : "anexar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => aoFotografar(a.id, e.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  className="press border border-border px-2 py-1 text-[11px] text-muted-foreground"
                  onClick={() => aoRemoverAvaria(a.id)}
                >
                  remover
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <Entrada
              rotulo={exigeAvaria ? "Descreva a avaria (obrigatório)" : "Descreva a observação"}
              value={descricao}
              areaClassName="min-w-[220px] flex-1"
              onChange={(e) => setDescricao(e.target.value)}
            />
            <Botao
              variante="linha"
              carregando={ocupado}
              onClick={() => {
                if (!descricao.trim()) {
                  toast.error("Descreva a avaria identificada.");
                  return;
                }
                aoRegistrarAvaria(descricao.trim());
                setDescricao("");
              }}
            >
              Adicionar
            </Botao>
          </div>
          <Selo tom={TOM_CONDICAO[item.condicao]}>{ROTULO_CONDICAO[item.condicao]}</Selo>
        </div>
      )}
    </li>
  );
}
