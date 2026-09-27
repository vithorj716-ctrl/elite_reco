import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { suave, Vazio } from "@/components/app/ui";
import {
  contasAReceber,
  dinheiro,
  lancamentosAtivos,
  somar,
  valorPagar,
  valorReceber,
  type LancamentoLocadora,
} from "@/domain/services/financeiro";
import { useBanco, useFotosDaOrdem } from "@/lib/sessao";
import { CHAVES, TERMO_PADRAO_RECIBO } from "@/services/configuracoes.service";
import { ROTULO_STATUS, type Banco, type Ordem } from "@/domain/types";
import { nomeServico } from "@/domain/services/catalogo";
import { avariasDaVistoria, itensDaVistoria, motoDaVistoria } from "@/domain/services/vistorias";
import { VistoriasService } from "@/services/vistorias.service";
import { ROTULO_CATEGORIA_FOTO, ROTULO_CONDICAO, ROTULO_STATUS_VISTORIA } from "@/domain/types";

export const Route = createFileRoute("/_app/documentos/$tipo/$id")({
  head: () => ({
    meta: [
      { title: "Emissão de documento — Recolhe" },
      {
        name: "description",
        content:
          "Fatura da locadora, recibo de repasse ao agente e laudo de recolhimento prontos para impressão.",
      },
      { property: "og:title", content: "Emissão de documento — Recolhe" },
      {
        property: "og:description",
        content: "Documentos gerados a partir dos registros operacionais do sistema.",
      },
    ],
  }),
  component: Documento,
});

const hoje = () => new Date().toLocaleString("pt-BR");

function Documento() {
  const { tipo, id } = Route.useParams();
  const banco = useBanco();

  useEffect(() => {
    document.body.classList.add("modo-documento");
    return () => document.body.classList.remove("modo-documento");
  }, []);

  const conteudo =
    tipo === "fatura" ? (
      <Fatura banco={banco} id={id} />
    ) : tipo === "recibo" ? (
      <Recibo banco={banco} id={id} />
    ) : tipo === "laudo" ? (
      <Laudo banco={banco} id={id} />
    ) : tipo === "laudo-vistoria" ? (
      <LaudoVistoria banco={banco} id={id} />
    ) : (
      <Vazio titulo="Documento desconhecido" texto="Use fatura, recibo, laudo ou laudo-vistoria." />
    );

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-8 md:py-10">
      <div className="nao-imprimir mb-6 flex items-center justify-between gap-3">
        <Link
          to="/financeiro"
          className="press inline-flex items-center gap-1.5 border border-border-strong px-3 py-2 text-[13px] hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Financeiro
        </Link>
        <button
          onClick={() => window.print()}
          className="press inline-flex items-center gap-1.5 border border-primary bg-primary/10 px-3 py-2 text-[13px] text-primary"
        >
          <Printer className="size-3.5" /> Imprimir / salvar PDF
        </button>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={suave}
        className="folha border border-border bg-surface p-6 md:p-10"
      >
        {conteudo}
      </motion.article>
    </div>
  );
}

function Cabecalho({ titulo, numero, sub }: { titulo: string; numero: string; sub: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-strong pb-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">Recolhe</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">{titulo}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Documento
        </p>
        <p className="font-mono text-[13px] text-foreground">{numero}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">Emitido em {hoje()}</p>
      </div>
    </header>
  );
}

function Linhas({
  banco,
  ordens,
  valorDe,
  nomeLocadora,
}: {
  banco: Banco;
  ordens: Ordem[];
  valorDe: (o: Ordem) => number;
  nomeLocadora?: (o: Ordem) => string;
}) {
  return (
    <table className="mt-6 w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border">
          <th className="label-caps py-2">Placa</th>
          <th className="label-caps py-2">{nomeLocadora ? "Locadora" : "Cidade"}</th>
          <th className="label-caps py-2">Serviço</th>
          <th className="label-caps py-2">Conclusão</th>
          <th className="label-caps py-2 text-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        {ordens.map((o) => (
          <tr key={o.id} className="border-b border-border/60">
            <td className="py-2 font-mono text-[12px] text-primary">{o.placa}</td>
            <td className="py-2 text-[12px] text-muted-foreground">
              {nomeLocadora ? nomeLocadora(o) : o.cidade}
            </td>
            <td className="py-2 text-[12px] text-muted-foreground">{nomeServico(banco, o)}</td>
            <td className="py-2 font-mono text-[11px] text-muted-foreground">
              {o.concluidaEm ? new Date(o.concluidaEm).toLocaleDateString("pt-BR") : "—"}
            </td>
            <td className="py-2 text-right font-mono text-[12px] text-foreground">
              {dinheiro(valorDe(o))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totais({
  ordens,
  valorDe,
  pagoDe,
}: {
  ordens: Ordem[];
  valorDe: (o: Ordem) => number;
  pagoDe: (o: Ordem) => boolean;
}) {
  const total = ordens.reduce((s, o) => s + valorDe(o), 0);
  const pago = ordens.filter(pagoDe).reduce((s, o) => s + valorDe(o), 0);
  return (
    <div className="mt-6 ml-auto w-full max-w-[320px] space-y-2 border-t border-border-strong pt-4">
      <Total rotulo="Serviços" valor={String(ordens.length)} />
      <Total rotulo="Total" valor={dinheiro(total)} />
      <Total rotulo="Liquidado" valor={dinheiro(pago)} />
      <Total rotulo="Em aberto" valor={dinheiro(total - pago)} destaque />
    </div>
  );
}

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="label-caps">{rotulo}</span>
      <span className={`font-mono text-[14px] ${destaque ? "text-primary" : "text-foreground"}`}>
        {valor}
      </span>
    </div>
  );
}

function Rodape({ texto }: { texto: string }) {
  return (
    <footer className="mt-10 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
      {texto}
    </footer>
  );
}

/**
 * Fatura da locadora: lê exatamente os mesmos lançamentos do financeiro.
 * Serviços e taxas aparecem separados, mas o total é a soma única da lista.
 */
function Fatura({ banco, id }: { banco: Banco; id: string }) {
  const loc = banco.locadoras.find((l) => l.id === id);
  if (!loc)
    return (
      <Vazio
        titulo="Locadora não encontrada"
        texto="Verifique o cadastro antes de emitir a fatura."
      />
    );

  const conta = contasAReceber(banco).find((c) => c.id === loc.id);
  const linhas = lancamentosAtivos(conta?.lancamentos ?? []);
  if (linhas.length === 0)
    return (
      <Vazio
        titulo="Sem valores faturáveis"
        texto="Esta locadora ainda não possui recolhimentos concluídos nem taxas em aberto."
      />
    );

  const servicos = linhas.filter((l) => l.tipo === "servico");
  const taxas = linhas.filter((l) => l.tipo === "taxa_cancelamento");
  const adicionais = linhas.filter((l) => l.tipo !== "servico" && l.tipo !== "taxa_cancelamento");
  const total = somar(linhas);
  const liquidado = somar(linhas.filter((l) => l.estado === "faturada"));

  return (
    <>
      <Cabecalho
        titulo="Fatura de serviços"
        numero={`FAT-${loc.id.slice(0, 6).toUpperCase()}`}
        sub={`${loc.nome} • CNPJ ${loc.cnpj || "—"} • ${loc.cidade}/${loc.uf}`}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Responsável" valor={loc.responsavel || "—"} />
        <Campo rotulo="Contato" valor={loc.telefone || loc.email || "—"} />
        <Campo rotulo="Lançamentos" valor={String(linhas.length)} />
      </div>

      <BlocoLancamentos titulo="Serviços" linhas={servicos} />
      <BlocoLancamentos titulo="Taxas" linhas={taxas} />
      <BlocoLancamentos titulo="Cobranças adicionais" linhas={adicionais} />

      <div className="mt-6 ml-auto w-full max-w-[320px] space-y-2 border-t border-border-strong pt-4">
        <Total rotulo="Serviços" valor={dinheiro(somar(servicos))} />
        {taxas.length > 0 && <Total rotulo="Taxas" valor={dinheiro(somar(taxas))} />}
        {adicionais.length > 0 && <Total rotulo="Adicionais" valor={dinheiro(somar(adicionais))} />}
        <Total rotulo="Total" valor={dinheiro(total)} />
        <Total rotulo="Liquidado" valor={dinheiro(liquidado)} />
        <Total rotulo="Em aberto" valor={dinheiro(total - liquidado)} destaque />
      </div>

      <Rodape texto="Valores conforme tabela de preços vigente acordada com a locadora. Taxas de cancelamento após o início do deslocamento seguem a regra de 50% aceita no ato do cancelamento. Cada recolhimento possui laudo com registro fotográfico, checklist e histórico imutável disponíveis no portal do cliente." />
    </>
  );
}

function BlocoLancamentos({ titulo, linhas }: { titulo: string; linhas: LancamentoLocadora[] }) {
  if (linhas.length === 0) return null;
  return (
    <section className="mt-6">
      <p className="label-caps">{titulo}</p>
      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="label-caps py-2">Ordem</th>
            <th className="label-caps py-2">Placa</th>
            <th className="label-caps py-2">Descrição</th>
            <th className="label-caps py-2">Data</th>
            <th className="label-caps py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b border-border/60">
              <td className="py-2 font-mono text-[12px] text-primary">{l.ordemCodigo}</td>
              <td className="py-2 font-mono text-[12px] text-muted-foreground">{l.placa}</td>
              <td className="py-2 text-[12px] text-muted-foreground">{l.descricao}</td>
              <td className="py-2 font-mono text-[11px] text-muted-foreground">
                {new Date(l.data).toLocaleDateString("pt-BR")}
              </td>
              <td className="py-2 text-right font-mono text-[12px] text-foreground">
                {dinheiro(l.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Recibo de um pagamento específico — com termo configurável e QR Code. */
function ReciboPagamento({
  banco,
  pagamento,
}: {
  banco: Banco;
  pagamento: {
    id: string;
    agenteId: string;
    valor: number;
    data: string;
    forma: string;
    responsavel: string;
    observacao: string;
  };
}) {
  const ag = banco.agentes.find((a) => a.id === pagamento.agenteId);
  const termo = banco.configuracoes[CHAVES.termoRecibo] ?? TERMO_PADRAO_RECIBO;
  const comQr = (banco.configuracoes[CHAVES.qrRecibo] ?? "1") === "1";
  const assinaturaEmpresa = banco.configuracoes[CHAVES.assinaturaRecibo] ?? "";
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!comQr) return;
    void QRCode.toDataURL(
      `RECOLHE|recibo=${pagamento.id}|agente=${pagamento.agenteId}|valor=${pagamento.valor.toFixed(2)}`,
      { margin: 1, width: 220, color: { dark: "#111111", light: "#ffffff" } },
    ).then(setQr);
  }, [comQr, pagamento.id, pagamento.agenteId, pagamento.valor]);

  return (
    <>
      <Cabecalho
        titulo="Recibo de pagamento"
        numero={`REC-${pagamento.id.slice(0, 8).toUpperCase()}`}
        sub={`${ag?.nome ?? "Agente"} • CPF ${ag?.cpf || "não informado"}`}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Campo rotulo="Valor" valor={dinheiro(pagamento.valor)} />
        <Campo rotulo="Forma de pagamento" valor={(pagamento.forma || "—").toUpperCase()} />
        <Campo rotulo="Data" valor={new Date(pagamento.data).toLocaleDateString("pt-BR")} />
        <Campo rotulo="Responsável" valor={pagamento.responsavel || "—"} />
      </div>

      <p className="mt-6 max-w-[70ch] text-[13px] leading-relaxed text-foreground">
        Recebi de <strong className="text-primary">Recolhe</strong> a importância de{" "}
        <strong className="text-primary">{dinheiro(pagamento.valor)}</strong>
        {pagamento.observacao ? ` — ${pagamento.observacao}` : ""}.
      </p>

      <p className="mt-4 max-w-[70ch] border-l-2 border-primary/40 pl-4 text-[12.5px] leading-relaxed text-muted-foreground">
        {termo}
      </p>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-8">
        <div className="min-w-[240px] flex-1">
          <Assinatura nome={ag?.nome ?? "Agente"} papel={`CPF ${ag?.cpf || "—"}`} />
        </div>
        <div className="min-w-[240px] flex-1">
          <Assinatura nome={assinaturaEmpresa || "Recolhe"} papel="Responsável pelo pagamento" />
        </div>
        {comQr && qr && (
          <img
            src={qr}
            alt="QR Code de conferência do recibo"
            className="size-24 border border-border"
          />
        )}
      </div>

      <Rodape texto="Recibo gerado automaticamente pelo sistema. O lançamento correspondente permanece registrado no extrato do agente e não pode ser alterado." />
    </>
  );
}

function Recibo({ banco, id }: { banco: Banco; id: string }) {
  const lancamento = banco.lancamentos.find((l) => l.id === id && l.tipo === "pagamento");
  if (lancamento)
    return (
      <ReciboPagamento
        banco={banco}
        pagamento={{
          id: lancamento.id,
          agenteId: lancamento.agenteId,
          valor: lancamento.valor,
          data: lancamento.data,
          forma: lancamento.forma,
          responsavel: lancamento.responsavel,
          observacao: lancamento.observacao || lancamento.descricao,
        }}
      />
    );

  const legado = banco.pagamentos.find((p) => p.id === id);
  if (legado)
    return (
      <ReciboPagamento
        banco={banco}
        pagamento={{
          id: legado.id,
          agenteId: legado.agenteId,
          valor: legado.valor,
          data: legado.pagoEm,
          forma: legado.forma,
          responsavel: legado.responsavel,
          observacao: legado.observacao,
        }}
      />
    );

  const ag = banco.agentes.find((a) => a.id === id);
  if (!ag)
    return (
      <Vazio
        titulo="Agente não encontrado"
        texto="Verifique o cadastro antes de emitir o recibo."
      />
    );
  const ordens = banco.ordens.filter((o) => o.status === "concluida" && o.agenteId === ag.id);
  if (ordens.length === 0)
    return <Vazio titulo="Sem repasses" texto="Este agente ainda não concluiu recolhimentos." />;
  const total = ordens.reduce((s, o) => s + valorPagar(banco, o), 0);

  return (
    <>
      <Cabecalho
        titulo="Recibo de repasse"
        numero={`REC-${ag.id.slice(0, 6).toUpperCase()}`}
        sub={`${ag.nome} • ${ag.cidade} • ${ag.telefone || "—"}`}
      />
      <p className="mt-5 max-w-[62ch] text-[13px] leading-relaxed text-foreground">
        Declaro para os devidos fins que executei os recolhimentos relacionados abaixo, totalizando{" "}
        <strong className="text-primary">{dinheiro(total)}</strong> em serviços prestados, conforme
        a tabela de repasse acordada.
      </p>
      <Linhas
        banco={banco}
        ordens={ordens}
        valorDe={(o) => valorPagar(banco, o)}
        nomeLocadora={(o) => banco.locadoras.find((l) => l.id === o.locadoraId)?.nome ?? "—"}
      />
      <Totais
        ordens={ordens}
        valorDe={(o) => valorPagar(banco, o)}
        pagoDe={(o) => !!o.pagamentoPago}
      />
      <div className="mt-14 grid gap-10 sm:grid-cols-2">
        <Assinatura nome={ag.nome} papel="Agente de campo" />
        <Assinatura nome="Recolhe" papel="Responsável operacional" />
      </div>
      <Rodape texto="Documento gerado automaticamente a partir das ordens concluídas registradas no sistema." />
    </>
  );
}

function Laudo({ banco, id }: { banco: Banco; id: string }) {
  // Imagens sob demanda: o laudo é a única tela que precisa delas em tamanho real.
  const { fotos } = useFotosDaOrdem(id);
  const o = banco.ordens.find((x) => x.id === id);
  if (!o) return <Vazio titulo="Ordem não encontrada" texto="O registro pode ter sido removido." />;
  const loc = banco.locadoras.find((l) => l.id === o.locadoraId);
  const ag = banco.agentes.find((a) => a.id === o.agenteId);

  const eventos = banco.historico
    .filter((h) => h.ordemId === o.id)
    .sort((a, b) => (a.quando < b.quando ? -1 : 1));

  return (
    <>
      <Cabecalho
        titulo="Laudo de recolhimento"
        numero={o.codigo}
        sub={`${o.placa} • ${o.marca} ${o.modelo} ${o.ano} • ${o.cor}`}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Locadora" valor={loc?.nome ?? "—"} />
        <Campo rotulo="Agente" valor={ag?.nome ?? "—"} />
        <Campo rotulo="Serviço" valor={nomeServico(banco, o)} />
        <Campo rotulo="Situação" valor={ROTULO_STATUS[o.status]} />
        <Campo rotulo="Endereço" valor={`${o.endereco} — ${o.cidade}`} />
        <Campo
          rotulo="Conclusão"
          valor={o.concluidaEm ? new Date(o.concluidaEm).toLocaleString("pt-BR") : "em aberto"}
        />
      </div>

      <Secao titulo="Checklist de vistoria">
        {o.checklist && o.checklist.length > 0 ? (
          <ul className="divide-y divide-border/60 border-y border-border">
            {o.checklist.map((c) => (
              <li key={c.item} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="text-[13px] text-foreground">{c.item}</span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                    c.conceito === "ruim"
                      ? "text-destructive"
                      : c.conceito === "regular"
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {c.conceito}
                </span>
                {c.descricao && (
                  <span className="text-[12px] text-muted-foreground">{c.descricao}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Vistoria não registrada.</p>
        )}
      </Secao>

      <Secao titulo={`Registro fotográfico (${fotos.length})`}>
        {fotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((f) => (
              <figure key={f.id} className="border border-border">
                <img
                  src={f.dataUrl}
                  alt={`Evidência ${f.etapa} da moto ${o.placa}`}
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="border-t border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {f.etapa}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma evidência anexada.</p>
        )}
      </Secao>

      <Secao titulo="Histórico">
        <ol className="space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 text-[12px]">
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(e.quando).toLocaleString("pt-BR")}
              </span>
              <span className="text-foreground">{e.acao}</span>
              <span className="text-muted-foreground">{e.quem}</span>
              {e.detalhe && <span className="text-muted-foreground">— {e.detalhe}</span>}
            </li>
          ))}
          {eventos.length === 0 && (
            <li className="text-[13px] text-muted-foreground">Sem eventos registrados.</li>
          )}
        </ol>
      </Secao>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <Assinatura nome={ag?.nome ?? "Agente"} papel="Executor do recolhimento" />
        <Assinatura nome={loc?.nome ?? "Locadora"} papel="Recebimento do veículo" />
      </div>
      <Rodape texto="Laudo emitido a partir de registros imutáveis do sistema, com data, hora e autoria de cada evento." />
    </>
  );
}

/**
 * Laudo de vistoria — documento próprio da inspeção periódica.
 * Traz KM, geolocalização, checklist item a item, avarias com foto e o
 * histórico imutável do que foi feito em campo.
 */
function LaudoVistoria({ banco, id }: { banco: Banco; id: string }) {
  const v = banco.vistorias.find((x) => x.id === id);
  const evidencias = useMemo(
    () => banco.evidenciasVistoria.filter((e) => e.vistoriaId === id),
    [banco.evidenciasVistoria, id],
  );
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    void Promise.all(
      evidencias.map(async (e) => [e.id, await VistoriasService.link(e, 1800)] as const),
    )
      .then((pares) => vivo && setUrls(Object.fromEntries(pares)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [evidencias]);

  if (!v)
    return <Vazio titulo="Vistoria não encontrada" texto="O registro pode ter sido removido." />;

  const moto = motoDaVistoria(banco, v);
  const loc = banco.locadoras.find((l) => l.id === v.locadoraId);
  const ag = banco.agentes.find((a) => a.id === v.agenteId);
  const itens = itensDaVistoria(banco, v.id);
  const avarias = avariasDaVistoria(banco, v.id);
  const eventos = banco.historicoVistoria
    .filter((h) => h.vistoriaId === v.id)
    .sort((a, b) => (a.quando < b.quando ? -1 : 1));

  return (
    <>
      <Cabecalho
        titulo="Laudo de vistoria"
        numero={v.codigo}
        sub={`${moto?.placa ?? "—"} • ${[moto?.marca, moto?.modelo, moto?.ano, moto?.cor].filter(Boolean).join(" ")}`}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Locadora" valor={loc?.nome ?? "—"} />
        <Campo rotulo="Agente" valor={ag?.nome ?? "—"} />
        <Campo rotulo="Situação" valor={ROTULO_STATUS_VISTORIA[v.status]} />
        <Campo
          rotulo="Quilometragem"
          valor={v.km === undefined || v.km === null ? "—" : `${v.km.toLocaleString("pt-BR")} km`}
        />
        <Campo
          rotulo="Geolocalização"
          valor={v.latitude ? `${v.latitude}, ${v.longitude}` : "não capturada"}
        />
        <Campo
          rotulo="Conclusão"
          valor={v.concluidaEm ? new Date(v.concluidaEm).toLocaleString("pt-BR") : "em aberto"}
        />
      </div>

      <Secao titulo="Checklist">
        {itens.length > 0 ? (
          <ul className="divide-y divide-border/60 border-y border-border">
            {itens.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="text-[13px] text-foreground">{i.item}</span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                    i.condicao === "ruim"
                      ? "text-destructive"
                      : i.condicao === "regular"
                        ? "text-warning"
                        : i.condicao === "bom"
                          ? "text-success"
                          : "text-muted-foreground"
                  }`}
                >
                  {ROTULO_CONDICAO[i.condicao]}
                </span>
                {i.observacao && (
                  <span className="text-[12px] text-muted-foreground">{i.observacao}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Checklist não registrado.</p>
        )}
      </Secao>

      <Secao titulo={`Avarias identificadas (${avarias.length})`}>
        {avarias.length > 0 ? (
          <ul className="divide-y divide-border/60 border-y border-border">
            {avarias.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-[13px] text-foreground">
                  {a.componente}
                  <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
                    {a.condicao}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground">{a.descricao}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma avaria registrada.</p>
        )}
      </Secao>

      <Secao titulo={`Registro fotográfico (${evidencias.length})`}>
        {evidencias.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidencias.map((e) => (
              <figure key={e.id} className="border border-border">
                {urls[e.id] ? (
                  <img
                    src={urls[e.id]}
                    alt={`Foto ${e.etapa} da moto ${moto?.placa ?? ""}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] w-full bg-elevado" />
                )}
                <figcaption className="border-t border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {ROTULO_CATEGORIA_FOTO[e.categoria]} · {e.etapa}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma foto anexada.</p>
        )}
      </Secao>

      <Secao titulo="Histórico">
        <ol className="space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 text-[12px]">
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(e.quando).toLocaleString("pt-BR")}
              </span>
              <span className="text-foreground">{e.acao}</span>
              <span className="text-muted-foreground">{e.quem}</span>
              {e.detalhe && <span className="text-muted-foreground">— {e.detalhe}</span>}
            </li>
          ))}
          {eventos.length === 0 && (
            <li className="text-[13px] text-muted-foreground">Sem eventos registrados.</li>
          )}
        </ol>
      </Secao>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <Assinatura nome={ag?.nome ?? "Agente"} papel="Executor da vistoria" />
        <Assinatura nome={loc?.nome ?? "Locadora"} papel="Ciência do laudo" />
      </div>
      <Rodape texto="Laudo emitido a partir de registros imutáveis: cada foto carrega marca d'água com data, hora, KM e coordenadas do momento da captura." />
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <p className="label-caps mb-3">{titulo}</p>
      {children}
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="label-caps">{rotulo}</p>
      <p className="mt-0.5 text-[13px] text-foreground">{valor}</p>
    </div>
  );
}

function Assinatura({ nome, papel }: { nome: string; papel: string }) {
  return (
    <div className="border-t border-border-strong pt-2">
      <p className="text-[13px] text-foreground">{nome}</p>
      <p className="label-caps">{papel}</p>
    </div>
  );
}
