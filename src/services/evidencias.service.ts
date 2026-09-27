import { conferirErro } from "@/data/erros";
/**
 * Evidências da captura: upload organizado no Storage e vínculo com a ordem.
 * Estrutura: locadoras/{locadoraId}/ordens/{ordemId}/evidencias/{tipo}/{arquivo}
 */
import { supabase } from "@/integrations/supabase/client";
import { paraEvidencia } from "@/domain/entities/mapeadores";
import type { Evidencia, TipoEvidencia } from "@/domain/types";

const BUCKET = "evidencias";

const PASTA: Record<TipoEvidencia, string> = {
  foto: "fotos",
  video: "videos",
  audio: "audios",
  documento: "documentos",
  assinatura: "assinaturas",
  comprovante: "comprovantes",
};

export function tipoPeloArquivo(arquivo: File): TipoEvidencia {
  if (arquivo.type.startsWith("image/")) return "foto";
  if (arquivo.type.startsWith("video/")) return "video";
  if (arquivo.type.startsWith("audio/")) return "audio";
  return "documento";
}

function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}

export interface ContextoEvidencia {
  ordemId: string;
  locadoraId: string;
  agenteId?: string | undefined;
  usuarioId?: string | undefined;
  etapa: string;
  gps?: string | undefined;
  observacao?: string | undefined;
}

export const EvidenciasService = {
  caminho(ctx: ContextoEvidencia, tipo: TipoEvidencia, nome: string) {
    return `locadoras/${ctx.locadoraId}/ordens/${ctx.ordemId}/evidencias/${PASTA[tipo]}/${Date.now()}-${nomeSeguro(nome)}`;
  },

  /** Envia o arquivo e registra a evidência vinculada à ordem. */
  async enviar(
    arquivo: File | Blob,
    ctx: ContextoEvidencia,
    opcoes?: { tipo?: TipoEvidencia; nome?: string },
  ) {
    const nome = opcoes?.nome ?? (arquivo instanceof File ? arquivo.name : "arquivo");
    const tipo = opcoes?.tipo ?? (arquivo instanceof File ? tipoPeloArquivo(arquivo) : "documento");
    const caminho = this.caminho(ctx, tipo, nome);

    const envio = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
    conferirErro(envio.error, "envio");

    const { data, error } = await supabase
      .from("ordem_evidencias")
      .insert({
        ordem_id: ctx.ordemId,
        locadora_id: ctx.locadoraId,
        agente_id: ctx.agenteId ?? null,
        usuario_id: ctx.usuarioId ?? null,
        tipo,
        etapa: ctx.etapa,
        nome,
        caminho,
        mime: arquivo.type || "",
        tamanho: arquivo.size,
        gps: ctx.gps ?? "",
        observacao: ctx.observacao ?? "",
      })
      .select("*")
      .single();
    conferirErro(error);
    return paraEvidencia(data);
  },

  /** Link temporário de visualização (bucket privado). */
  async link(evidencia: Evidencia, segundos = 3600) {
    if (!evidencia.caminho) return evidencia.url || "";
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(evidencia.caminho, segundos);
    conferirErro(error, "download");
    return data!.signedUrl;
  },

  /**
   * Remove do storage todos os arquivos de uma ordem antes que ela seja
   * apagada. Sem isso os arquivos ficariam órfãos no bucket privado, sem
   * nenhuma referência no banco para recuperá-los ou removê-los depois.
   */
  async limparDaOrdem(ordemId: string) {
    const { data, error } = await supabase
      .from("ordem_evidencias")
      .select("caminho")
      .eq("ordem_id", ordemId);
    conferirErro(error);
    const caminhos = (data ?? []).map((e) => e.caminho).filter((c): c is string => Boolean(c));
    if (caminhos.length === 0) return;
    const remocao = await supabase.storage.from(BUCKET).remove(caminhos);
    conferirErro(remocao.error, "envio");
  },
};
