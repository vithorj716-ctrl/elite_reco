import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Botao,
  CabecalhoTabela,
  CorpoTabela,
  LinhaTabela,
  Pagina,
  Tabela,
  Vazio,
} from "@/components/app/ui";
import { OrdensService, type NovaOrdem } from "@/services/ordens.service";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import type { Prioridade } from "@/domain/types";
import { servicosDaLocadora } from "@/domain/services/catalogo";

export const Route = createFileRoute("/_app/importacoes")({
  head: () => ({
    meta: [
      { title: "Importação de planilhas — Recolhe" },
      { name: "description", content: "Importe planilhas das locadoras e gere ordens de recolhimento em lote." },
      { property: "og:title", content: "Importação de planilhas — Recolhe" },
      { property: "og:description", content: "Upload de XLSX/CSV com pré-visualização antes de criar as ordens." },
    ],
  }),
  component: Importacoes,
});

type Linha = Record<string, string | number | undefined>;

function txt(v: unknown) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function achar(linha: Linha, chaves: string[]) {
  const entradas = Object.entries(linha);
  for (const chave of chaves) {
    const achado = entradas.find(([k]) => k.toLowerCase().replace(/\s|_/g, "").includes(chave));
    if (achado) return txt(achado[1]);
  }
  return "";
}

function Importacoes() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const inputRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [locadoraId, setLocadoraId] = useState(banco.locadoras[0]?.id ?? "");
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const sincronizar = useSincronizar();

  async function ler(file: File) {
    setLendo(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const primeira = wb.SheetNames[0];
      if (!primeira) throw new Error("planilha vazia");
      const json = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[primeira]!, { defval: "" });
      setLinhas(json);
      setArquivo(file.name);
      toast.success(`${json.length} linha(s) lida(s) de ${file.name}.`);
    } catch {
      toast.error("Não foi possível ler o arquivo. Use XLSX ou CSV.");
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    if (!locadoraId || linhas.length === 0) return;
    // Planilha sem placa não vira ordem: placa é a chave da operação em campo
    const semPlaca = linhas.filter((l) => !achar(l, ["placa"]).trim()).length;
    if (semPlaca > 0) {
      toast.error(`${semPlaca} linha(s) sem placa. Corrija a planilha antes de importar.`);
      return;
    }
    const disponiveis = servicosDaLocadora(banco, locadoraId);
    if (disponiveis.length === 0) {
      toast.error("Esta locadora não tem serviços na tabela vinculada. Configure a tabela antes de importar.");
      return;
    }
    const normalizar = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const novas: NovaOrdem[] = linhas.map((l, i) => {
      const prio = achar(l, ["prioridade"]).toLowerCase();
      const serv = achar(l, ["servico", "serviço", "tipo"]).toLowerCase();
      return {
        locadoraId,
        placa: achar(l, ["placa"]).toUpperCase(),
        marca: achar(l, ["marca"]) || "—",
        modelo: achar(l, ["modelo"]) || "—",
        ano: achar(l, ["ano"]) || "—",
        cor: achar(l, ["cor"]) || "—",
        valorPendente: Number(achar(l, ["valor", "debito", "débito"]).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0,
        telefone: achar(l, ["telefone", "contato", "fone"]) || "—",
        endereco: achar(l, ["endereco", "endereço", "rua"]) || "—",
        cidade: achar(l, ["cidade"]) || "—",
        observacoes: achar(l, ["observ"]) || undefined,
        linkRastreador: achar(l, ["link", "rastre"]) || undefined,
        prioridade: (["baixa", "normal", "alta", "urgente"].includes(prio) ? prio : "normal") as Prioridade,
        servicoId: (
          disponiveis.find(
            (sv) => normalizar(sv.nome) === normalizar(serv) || normalizar(sv.codigo) === normalizar(serv),
          ) ??
          disponiveis.find((sv) => normalizar(serv) && normalizar(sv.nome).includes(normalizar(serv))) ??
          disponiveis[0]!
        ).id,
      };
    });

    setEnviando(true);
    try {
      const criadas = await OrdensService.criarLote(novas);
      await OrdensService.registrarImportacao(
        locadoraId,
        arquivo,
        criadas.length,
        usuario?.nome ?? "Operador",
      );
      await Promise.all(
        criadas.map((o) =>
          OrdensService.registrarHistorico(
            o.id,
            usuario?.nome ?? "Operador",
            "Ordem criada por importação",
            arquivo,
          ),
        ),
      );
      await sincronizar(["ordens", "importacoes", "ordem_historico"]);
      setLinhas([]);
      setArquivo("");
      toast.success(`${criadas.length} ordem(ns) criada(s) na fila.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const colunas = linhas[0] ? Object.keys(linhas[0]).slice(0, 7) : [];

  return (
    <Pagina
      titulo="Importação de planilhas"
      descricao="Cada linha vira uma ordem de recolhimento pendente."
      acoes={
        linhas.length > 0 ? (
          <Botao variante="solido" onClick={confirmar} carregando={enviando}>
            Criar {linhas.length} ordem(ns)
          </Botao>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void ler(f);
            }}
            className="border border-dashed border-border-strong bg-surface px-6 py-12 text-center transition-colors hover:border-primary"
          >
            <Upload className="mx-auto size-5 text-primary" />
            <p className="mt-3 text-[14px] text-foreground">Arraste a planilha aqui</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              XLSX ou CSV com colunas de placa, modelo, cidade, endereço e valor.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void ler(f);
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="press mt-5 border border-border-strong px-4 py-2 text-[13px] hover:border-primary hover:text-primary"
            >
              {lendo ? "lendo arquivo…" : "selecionar arquivo"}
            </button>
          </div>

          {linhas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 border border-border"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
                <p className="label-caps">Pré-visualização · {arquivo}</p>
                <select
                  value={locadoraId}
                  onChange={(e) => setLocadoraId(e.target.value)}
                  className="ml-auto border border-border bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary"
                >
                  {banco.locadoras.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>
              <Tabela minLargura={640} className="border-0">
                <CabecalhoTabela colunas={colunas} />
                <CorpoTabela>
                  {linhas.slice(0, 8).map((l, i) => (
                    <LinhaTabela key={i}>
                      {colunas.map((c) => (
                        <td key={c} className="whitespace-nowrap px-3 py-2 text-[12px] text-muted-foreground">
                          {txt(l[c])}
                        </td>
                      ))}
                    </LinhaTabela>
                  ))}
                </CorpoTabela>
              </Tabela>
              {linhas.length > 8 && (
                <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
                  + {linhas.length - 8} linha(s) não exibida(s).
                </p>
              )}
            </motion.div>
          )}
        </div>

        <section className="border border-border">
          <p className="label-caps border-b border-border px-4 py-2.5">Importações anteriores</p>
          {banco.importacoes.length === 0 ? (
            <Vazio titulo="Nada importado ainda" texto="O histórico aparece aqui após o primeiro envio." />
          ) : (
            <ul className="divide-y divide-border">
              {banco.importacoes.map((imp) => (
                <li key={imp.id} className="px-4 py-3">
                  <p className="flex items-center gap-2 text-[13px] text-foreground">
                    <FileSpreadsheet className="size-3.5 text-primary" /> {imp.arquivo}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {imp.total} ordens • {imp.autor} • {new Date(imp.criadaEm).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}
