/**
 * Interpretação por IA das mensagens coladas no importador inteligente.
 * Roda no servidor: a chave da IA nunca chega ao navegador.
 */
import { createServerFn } from "@tanstack/react-start";

const CAMPOS = `placa, marca, modelo, cor, ano, locatario, cpf, telefone, telefoneSecundario,
host, pin, valorPendente (número), situacaoFinanceira, statusInformado, ultimoRastreio,
endereco, bairro, cidade, uf, cep, latitude, longitude, linkMaps, linkRastreador,
responsavel, prioridade (baixa|normal|alta|urgente), locadoraTexto (nome da locadora citada),
observacoes, resumo (resumo operacional em tópicos curtos iniciados por "• ")`;

const SISTEMA = `Você extrai dados operacionais de mensagens sobre recolhimento de motocicletas.
As mensagens vêm de WhatsApp, e-mail, PDF, planilhas ou texto livre, podem ter emojis,
estar incompletas ou conter VÁRIAS motos.
Responda SOMENTE em JSON no formato {"itens":[{...}]}, um objeto por motocicleta encontrada.
Campos permitidos: ${CAMPOS}.
Use string vazia quando não encontrar. Nunca invente dados. Não explique nada.`;

export type ItemBruto = Record<string, string | number | boolean | null>;

export interface RespostaIa {
  itens: ItemBruto[];
  erro?: string | undefined;
}

export const interpretarMensagem = createServerFn({ method: "POST" })
  .inputValidator((entrada: { texto: string }) => {
    const texto = String(entrada?.texto ?? "").slice(0, 20000);
    if (!texto.trim()) throw new Error("Cole uma mensagem para interpretar.");
    return { texto };
  })
  .handler(async ({ data }): Promise<RespostaIa> => {
    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) return { itens: [], erro: "IA indisponível — extração feita apenas por padrões." };

    try {
      const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": chave,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            { role: "system", content: SISTEMA },
            { role: "user", content: data.texto },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.text();
        console.error(`IA falhou [${resposta.status}]: ${corpo}`);
        if (resposta.status === 429) return { itens: [], erro: "Limite de uso da IA atingido. Tente novamente em instantes." };
        if (resposta.status === 402) return { itens: [], erro: "Créditos de IA esgotados." };
        return { itens: [], erro: "A IA não respondeu — usando apenas os padrões locais." };
      }

      const json = (await resposta.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const conteudo = json.choices?.[0]?.message?.content ?? "{}";
      const dados = JSON.parse(conteudo) as { itens?: unknown };
      const itens = Array.isArray(dados.itens) ? dados.itens : [];
      return { itens: itens as ItemBruto[] };
    } catch (e) {
      console.error("Falha ao interpretar mensagem", e);
      return { itens: [], erro: "Não foi possível interpretar com IA — usando padrões locais." };
    }
  });
