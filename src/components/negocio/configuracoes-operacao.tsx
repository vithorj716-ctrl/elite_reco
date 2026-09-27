/**
 * Configuração administrativa da regra de horário especial.
 *
 * O horário de início e os adicionais de referência ficam aqui — nunca no
 * código. Estes valores só orientam a definição da operação: quem confirma o
 * valor final continua sendo o administrador, operação por operação. Alterar
 * esta configuração nunca muda uma operação já liberada.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/app/ui";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import {
  CHAVES,
  ConfiguracoesService,
  PADRAO_HORARIO_ESPECIAL,
} from "@/services/configuracoes.service";
import { useSincronizar } from "@/lib/sessao";
import type { Banco } from "@/domain/types";

const numero = (v: string | undefined) => {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function ConfiguracoesOperacao({ banco }: { banco: Banco }) {
  const sincronizar = useSincronizar();
  const horarioSalvo = banco.configuracoes[CHAVES.horarioEspecialInicio] ?? PADRAO_HORARIO_ESPECIAL;
  const cobrancaSalva = numero(banco.configuracoes[CHAVES.adicionalCobrancaHorario]);
  const pagamentoSalvo = numero(banco.configuracoes[CHAVES.adicionalPagamentoHorario]);

  const [horario, setHorario] = useState(horarioSalvo);
  const [cobranca, setCobranca] = useState(cobrancaSalva);
  const [pagamento, setPagamento] = useState(pagamentoSalvo);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setHorario(horarioSalvo), [horarioSalvo]);
  useEffect(() => setCobranca(cobrancaSalva), [cobrancaSalva]);
  useEffect(() => setPagamento(pagamentoSalvo), [pagamentoSalvo]);

  const salvar = async () => {
    if (!/^\d{2}:\d{2}$/.test(horario)) {
      toast.error("Informe o horário no formato 00:00.");
      return;
    }
    setSalvando(true);
    try {
      await ConfiguracoesService.definir(CHAVES.horarioEspecialInicio, horario);
      await ConfiguracoesService.definir(CHAVES.adicionalCobrancaHorario, String(cobranca));
      await ConfiguracoesService.definir(CHAVES.adicionalPagamentoHorario, String(pagamento));
      await sincronizar("configuracoes");
      toast.success("Regra de horário salva. Operações já liberadas não mudam.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="border border-border">
      <header className="border-b border-border px-4 py-3">
        <p className="label-caps">Horário especial das operações</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Vale pelo horário em que a operação foi lançada — não pelo aceite, deslocamento ou
          finalização. Os adicionais abaixo são referência para a definição; o valor final de cada
          operação continua sendo confirmado pelo administrador.
        </p>
      </header>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-3">
        <label className="block">
          <span className="label-caps">Início do horário especial</span>
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="17:00"
            aria-label="Início do horário especial"
            className="campo mt-1 w-full"
          />
        </label>
        <CampoMoeda
          rotulo="Adicional de referência — cobrança da locadora"
          valor={cobranca}
          aoAlterar={setCobranca}
        />
        <CampoMoeda
          rotulo="Adicional de referência — repasse do agente"
          valor={pagamento}
          aoAlterar={setPagamento}
        />
      </div>
      <footer className="flex justify-end border-t border-border px-4 py-3">
        <Botao variante="solido" carregando={salvando} onClick={salvar}>
          Salvar regra de horário
        </Botao>
      </footer>
    </section>
  );
}
