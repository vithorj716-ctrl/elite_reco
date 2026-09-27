/**
 * Painel operacional do agente em campo: contato, rastreamento, PIN e endereço
 * com ações de um toque só.
 */
import { motion } from "motion/react";
import { Copy, ExternalLink, Lock, MapPin, MessageCircle, Phone, Radar } from "lucide-react";
import { toast } from "sonner";
import { Status } from "@/components/app/ui";
import { useBanco } from "@/lib/sessao";
import type { Ordem } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Mantém a URL exatamente como recebida — só valida e completa o protocolo. */
export function normalizarHost(host: string): string | null {
  const bruto = (host ?? "").trim();
  if (!bruto) return null;
  const comProtocolo = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  try {
    const url = new URL(comProtocolo);
    if (!url.hostname.includes(".")) return null;
    return comProtocolo;
  } catch {
    return null;
  }
}

/** 55 + DDD + número, sem máscara. */
export function normalizarTelefone(telefone: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const semDdi = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (semDdi.length < 10 || semDdi.length > 11) return null;
  return `55${semDdi}`;
}

function enderecoCompleto(ordem: Ordem): string {
  return [ordem.endereco, ordem.bairro, ordem.cidade, ordem.uf, ordem.cep]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function linkMapa(ordem: Ordem): string | null {
  if (ordem.linkMaps?.trim()) return ordem.linkMaps.trim();
  if (ordem.latitude?.trim() && ordem.longitude?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${ordem.latitude.trim()},${ordem.longitude.trim()}`,
    )}`;
  }
  const texto = enderecoCompleto(ordem);
  if (!texto) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

const CARTAO = "border border-border bg-surface";
const ACAO =
  "press inline-flex min-h-13 flex-1 items-center justify-center gap-2 px-4 text-[14px] font-medium tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-45";

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="label-caps px-4 pt-3">{children}</p>;
}

export function PainelCampo({
  ordem,
  rastreamentoBloqueado = false,
}: {
  ordem: Ordem;
  /** Regra de campo: o rastreador só abre depois de iniciado o deslocamento. */
  rastreamentoBloqueado?: boolean;
}) {
  const telefones = [ordem.telefone, ordem.telefoneSecundario]
    .map((t) => (t ?? "").trim())
    .filter(Boolean);
  // O rastreador é cadastro da moto: a ordem só usa o próprio dado como fallback.
  const banco = useBanco();
  const moto = banco.motos.find(
    (m) =>
      m.locadoraId === ordem.locadoraId &&
      m.placa.toUpperCase() === (ordem.placa ?? "").toUpperCase(),
  );
  const hostBruto = (moto?.host || ordem.host || ordem.linkRastreador || "").trim();
  const host = normalizarHost(hostBruto);
  const mapa = linkMapa(ordem);
  const pin = (moto?.pin || ordem.pin || "").trim();

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-3">
      {/* 1 — Status */}
      <div className="flex flex-wrap items-center gap-3">
        <Status valor={ordem.status} />
        <span className="font-mono text-[12px] text-muted-foreground">{ordem.codigo}</span>
      </div>

      {/* 2/3/4/5 — Locatário e contato */}
      <section className={CARTAO}>
        <Rotulo>Locatário</Rotulo>
        <p className="px-4 pb-2 text-[18px] font-semibold leading-tight text-foreground">
          {ordem.locatario?.trim() || "Não informado"}
        </p>
        {telefones.length === 0 ? (
          <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            Telefone não informado.
          </p>
        ) : (
          telefones.map((tel) => {
            const zap = normalizarTelefone(tel);
            return (
              <div key={tel} className="border-t border-border">
                <div className="flex items-center gap-3 px-4 py-3">
                  <p className="min-w-0 flex-1 truncate font-mono text-[24px] leading-none tracking-tight text-foreground">
                    {tel}
                  </p>
                  <button
                    onClick={() => void copiar(tel, "Telefone copiado.")}
                    aria-label="Copiar telefone"
                    className="press shrink-0 border border-border-strong p-2.5 text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
                <div className="flex gap-px border-t border-border bg-border">
                  <motion.a
                    whileTap={{ scale: 0.98 }}
                    href={zap ? `https://wa.me/${zap}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!zap}
                    className={cn(
                      ACAO,
                      "bg-success/12 text-success hover:bg-success/20",
                      !zap && "pointer-events-none opacity-45",
                    )}
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </motion.a>
                  <motion.a
                    whileTap={{ scale: 0.98 }}
                    href={`tel:${tel.replace(/[^\d+]/g, "")}`}
                    className={cn(ACAO, "bg-surface-raised text-foreground hover:text-primary")}
                  >
                    <Phone className="size-4" /> Ligar
                  </motion.a>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* 6/7/8 — Placa, rastreamento e host */}
      <section className={CARTAO}>
        <Rotulo>Placa</Rotulo>
        <div className="flex items-center gap-3 px-4 pb-3">
          <p className="font-mono text-[26px] leading-none tracking-[0.12em] text-foreground">
            {ordem.placa}
          </p>
          <button
            onClick={() => void copiar(ordem.placa, "Placa copiada.")}
            aria-label="Copiar placa"
            className="press ml-auto shrink-0 border border-border-strong p-2.5 text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <motion.a
          whileTap={{ scale: 0.99 }}
          href={rastreamentoBloqueado ? undefined : (host ?? undefined)}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!host || rastreamentoBloqueado}
          onClick={(e) => {
            if (rastreamentoBloqueado) {
              e.preventDefault();
              toast.error("Para acessar o rastreamento é obrigatório iniciar o deslocamento.");
            }
          }}
          className={cn(
            ACAO,
            "flex w-full border-t border-border bg-primary/15 text-primary hover:bg-primary/25",
            !host && !rastreamentoBloqueado && "pointer-events-none opacity-45",
            rastreamentoBloqueado && "cursor-not-allowed opacity-45",
          )}
        >
          {rastreamentoBloqueado ? <Lock className="size-4" /> : <Radar className="size-4" />}
          {rastreamentoBloqueado ? "Rastreamento bloqueado" : "Abrir rastreamento"}
        </motion.a>
        {rastreamentoBloqueado ? (
          <p className="border-t border-border px-4 py-2.5 text-[12px] text-warning">
            Para acessar o rastreamento é obrigatório iniciar o deslocamento.
          </p>
        ) : (
          !host && (
            <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
              {hostBruto ? "Link de rastreamento inválido." : "Rastreamento não informado."}
            </p>
          )
        )}
        {hostBruto && !rastreamentoBloqueado && (
          <div className="flex items-start gap-2 border-t border-border px-4 py-2.5">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">
              {hostBruto}
            </p>
            <button
              onClick={() => void copiar(hostBruto, "Link copiado.")}
              aria-label="Copiar link do rastreador"
              className="press shrink-0 text-muted-foreground hover:text-primary"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* 9/10 — PIN */}
      {pin && (
        <section className={cn(CARTAO, "border-l-2 border-l-primary")}>
          <Rotulo>PIN</Rotulo>
          <div className="flex items-center gap-3 px-4 pb-3">
            <p className="font-mono text-[32px] leading-none tracking-[0.22em] text-primary">
              {pin}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => void copiar(pin, "PIN copiado.")}
            className={cn(
              ACAO,
              "flex w-full border-t border-border bg-surface-raised hover:text-primary",
            )}
          >
            <Copy className="size-4" /> Copiar PIN
          </motion.button>
        </section>
      )}

      {/* 11/12 — Endereço */}
      <section className={CARTAO}>
        <Rotulo>Endereço</Rotulo>
        <div className="space-y-1 px-4 pb-3 text-[14px] leading-relaxed text-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-1 size-3.5 shrink-0 text-primary" />
            <span>{enderecoCompleto(ordem) || "Endereço não informado"}</span>
          </p>
        </div>
        <motion.a
          whileTap={{ scale: 0.99 }}
          href={mapa ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!mapa}
          className={cn(
            ACAO,
            "flex w-full border-t border-border bg-surface-raised hover:text-primary",
            !mapa && "pointer-events-none opacity-45",
          )}
        >
          <MapPin className="size-4" /> Abrir no Google Maps
        </motion.a>
      </section>

      {/* 13 — Observações */}
      {(ordem.observacoes?.trim() || ordem.resumoIa?.trim()) && (
        <section className={CARTAO}>
          <Rotulo>Observações</Rotulo>
          <p className="whitespace-pre-line px-4 pb-3 text-[13px] leading-relaxed text-muted-foreground">
            {[ordem.resumoIa?.trim(), ordem.observacoes?.trim()].filter(Boolean).join("\n\n")}
          </p>
        </section>
      )}
    </div>
  );
}
