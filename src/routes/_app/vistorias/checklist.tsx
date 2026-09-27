/**
 * Catálogo do checklist de vistoria — administração pela central.
 *
 * Os itens avaliados em campo saem daqui: a central cria, renomeia, ordena,
 * marca o que é obrigatório e quando a foto é exigida. Itens já usados em
 * vistorias antigas nunca são reescritos — o histórico permanece intacto.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from "lucide-react";
import { Botao, Metrica, Pagina, Secao, Selo, Vazio } from "@/components/app/ui";
import { Entrada } from "@/components/negocio/formulario";
import { useConfirmacao } from "@/components/app/confirmar";
import { useBanco, useSincronizar } from "@/lib/sessao";
import { ChecklistVistoriaService } from "@/services/checklist-vistoria.service";
import type { ItemChecklistCatalogo } from "@/domain/types";

export const Route = createFileRoute("/_app/vistorias/checklist")({
  head: () => ({
    meta: [
      { title: "Itens do checklist de vistoria — Recolhe" },
      {
        name: "description",
        content:
          "Configuração dos itens avaliados na vistoria: ordem, obrigatoriedade e exigência de foto.",
      },
      { property: "og:title", content: "Itens do checklist de vistoria — Recolhe" },
      {
        property: "og:description",
        content: "Administre o catálogo de itens avaliados em campo pelos agentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogoChecklist,
});

function CatalogoChecklist() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const { pedir, dialogo } = useConfirmacao();

  const itens = useMemo(
    () => [...(banco.catalogoChecklist ?? [])].sort((a, b) => a.posicao - b.posicao),
    [banco.catalogoChecklist],
  );

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try {
      await acao();
      toast.success(sucesso);
      sincronizar(["vistoria_checklist_itens"] as never);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const adicionar = () => {
    if (!novo.trim()) {
      toast.error("Informe o nome do item.");
      return;
    }
    const posicao = (itens.at(-1)?.posicao ?? 0) + 10;
    void executar(
      () => ChecklistVistoriaService.criar({ nome: novo, posicao, obrigatorio: true }),
      "Item adicionado ao checklist.",
    ).then(() => setNovo(""));
  };

  const remover = async (item: ItemChecklistCatalogo) => {
    const ok = await pedir({
      titulo: "Excluir item do checklist",
      texto: `O item "${item.nome}" deixa de aparecer nas próximas vistorias. Vistorias já feitas mantêm o registro — prefira desativar quando o item ainda for histórico relevante.`,
      confirmar: "Excluir item",
    });
    if (ok) await executar(() => ChecklistVistoriaService.excluir(item.id), "Item excluído.");
  };

  const mover = (item: ItemChecklistCatalogo, direcao: -1 | 1) => {
    const i = itens.indexOf(item);
    const alvo = itens[i + direcao];
    if (!alvo) return;
    void executar(
      () =>
        ChecklistVistoriaService.reordenar([
          { id: item.id, posicao: alvo.posicao },
          { id: alvo.id, posicao: item.posicao },
        ]),
      "Ordem atualizada.",
    );
  };

  return (
    <Pagina
      titulo="Itens do checklist"
      descricao="O agente avalia cada item como bom, regular ou ruim. Itens ruins sempre exigem descrição e foto da avaria."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Itens ativos" valor={itens.filter((i) => i.ativo).length} destaque />
        <Metrica rotulo="Obrigatórios" valor={itens.filter((i) => i.obrigatorio).length} />
        <Metrica rotulo="Inativos" valor={itens.filter((i) => !i.ativo).length} />
      </div>

      <Secao titulo="Novo item" className="mt-4">
        <div className="flex flex-wrap items-end gap-2">
          <Entrada
            rotulo="Nome do item"
            placeholder="Ex.: Pastilhas de freio"
            value={novo}
            areaClassName="min-w-[240px] flex-1"
            onChange={(e) => setNovo(e.target.value)}
          />
          <Botao onClick={adicionar} carregando={ocupado}>
            <Plus className="size-3.5" aria-hidden /> Adicionar
          </Botao>
        </div>
      </Secao>

      <Secao titulo="Catálogo" className="mt-4">
        {itens.length === 0 ? (
          <Vazio
            icone={ListChecks}
            titulo="Nenhum item cadastrado"
            texto="Adicione os itens que o agente deve avaliar em cada vistoria."
          />
        ) : (
          <ul className="grid gap-px bg-border">
            {itens.map((item, i) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2"
              >
                <div className="flex min-w-[200px] flex-1 items-center gap-2">
                  <span className="text-[13px]">{item.nome}</span>
                  {!item.ativo && <Selo tom="neutro">inativo</Selo>}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Alternador
                    rotulo="obrigatório"
                    ativo={item.obrigatorio}
                    onClick={() =>
                      executar(
                        () =>
                          ChecklistVistoriaService.atualizar(item.id, {
                            obrigatorio: !item.obrigatorio,
                          }),
                        "Item atualizado.",
                      )
                    }
                  />
                  <Alternador
                    rotulo="foto se ruim"
                    ativo={item.fotoQuandoRuim}
                    onClick={() =>
                      executar(
                        () =>
                          ChecklistVistoriaService.atualizar(item.id, {
                            fotoQuandoRuim: !item.fotoQuandoRuim,
                          }),
                        "Item atualizado.",
                      )
                    }
                  />
                  <Alternador
                    rotulo="foto se regular"
                    ativo={item.fotoQuandoRegular}
                    onClick={() =>
                      executar(
                        () =>
                          ChecklistVistoriaService.atualizar(item.id, {
                            fotoQuandoRegular: !item.fotoQuandoRegular,
                          }),
                        "Item atualizado.",
                      )
                    }
                  />
                  <Alternador
                    rotulo={item.ativo ? "ativo" : "reativar"}
                    ativo={item.ativo}
                    onClick={() =>
                      executar(
                        () => ChecklistVistoriaService.desativar(item.id, !item.ativo),
                        item.ativo ? "Item desativado." : "Item reativado.",
                      )
                    }
                  />

                  <button
                    type="button"
                    aria-label="Subir item"
                    disabled={i === 0}
                    onClick={() => mover(item, -1)}
                    className="press border border-border p-1 text-muted-foreground disabled:opacity-40"
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Descer item"
                    disabled={i === itens.length - 1}
                    onClick={() => mover(item, 1)}
                    className="press border border-border p-1 text-muted-foreground disabled:opacity-40"
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir item"
                    onClick={() => void remover(item)}
                    className="press border border-border p-1 text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {dialogo}
    </Pagina>
  );
}

function Alternador({
  rotulo,
  ativo,
  onClick,
}: {
  rotulo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press border px-2 py-1 ${
        ativo ? "border-primary text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {rotulo}
    </button>
  );
}
