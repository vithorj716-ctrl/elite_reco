/**
 * Configurações do recibo de pagamento: termo de declaração editável,
 * QR Code opcional e assinatura. Nada fica fixo no código.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/app/ui";
import {
  CHAVES,
  ConfiguracoesService,
  TERMO_PADRAO_RECIBO,
} from "@/services/configuracoes.service";
import { useSincronizar } from "@/lib/sessao";
import type { Banco } from "@/domain/types";

export function ConfiguracoesRecibo({ banco }: { banco: Banco }) {
  const sincronizar = useSincronizar();
  const salvo = banco.configuracoes[CHAVES.termoRecibo] ?? TERMO_PADRAO_RECIBO;
  const qrSalvo = (banco.configuracoes[CHAVES.qrRecibo] ?? "1") === "1";
  const assinaturaSalva = banco.configuracoes[CHAVES.assinaturaRecibo] ?? "";

  const [termo, setTermo] = useState(salvo);
  const [qr, setQr] = useState(qrSalvo);
  const [assinatura, setAssinatura] = useState(assinaturaSalva);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setTermo(salvo), [salvo]);
  useEffect(() => setQr(qrSalvo), [qrSalvo]);
  useEffect(() => setAssinatura(assinaturaSalva), [assinaturaSalva]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await ConfiguracoesService.definir(CHAVES.termoRecibo, termo.trim());
      await ConfiguracoesService.definir(CHAVES.qrRecibo, qr ? "1" : "0");
      await ConfiguracoesService.definir(CHAVES.assinaturaRecibo, assinatura.trim());
      await sincronizar("configuracoes");
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="border border-border">
        <header className="border-b border-border px-4 py-3">
          <p className="label-caps">Termo do recibo</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Texto impresso em todo recibo de pagamento ao agente. Pode ser reescrito a qualquer
            momento.
          </p>
        </header>
        <div className="px-4 py-4">
          <textarea
            rows={6}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="w-full resize-y border border-border bg-surface-raised px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary"
          />
          <button
            onClick={() => setTermo(TERMO_PADRAO_RECIBO)}
            className="press mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
          >
            restaurar texto sugerido
          </button>
        </div>
      </section>

      <section className="grid gap-px border border-border bg-border md:grid-cols-2">
        <label className="flex items-center gap-3 bg-surface px-4 py-4">
          <input
            type="checkbox"
            checked={qr}
            onChange={(e) => setQr(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          <span>
            <span className="block text-[13px] text-foreground">Imprimir QR Code no recibo</span>
            <span className="block text-[11.5px] text-muted-foreground">
              Permite conferir o pagamento pelo código do lançamento.
            </span>
          </span>
        </label>
        <label className="bg-surface px-4 py-4">
          <span className="label-caps">Assinatura impressa</span>
          <input
            value={assinatura}
            onChange={(e) => setAssinatura(e.target.value)}
            placeholder="Nome de quem assina pela empresa (opcional)"
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <span className="mt-1 block text-[11.5px] text-muted-foreground">
            Em branco, o recibo imprime apenas a linha para assinatura manual.
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <Botao onClick={salvar} carregando={salvando}>
          Salvar configurações
        </Botao>
      </div>
    </div>
  );
}
