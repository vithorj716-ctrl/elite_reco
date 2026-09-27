import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  ITENS_CHECKLIST,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
} from "@/domain/types";

export default defineTool({
  name: "referencia_sistema",
  title: "Referência do sistema",
  description:
    "Lista os valores de referência do sistema de recolhimentos: status de ordem, prioridades e itens do checklist de vistoria. Os serviços são configuráveis no banco.",
  inputSchema: {},
  outputSchema: {
    status: z.record(z.string()),
    prioridades: z.record(z.string()),
    checklist_vistoria: z.array(z.string()),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const dados = {
      status: ROTULO_STATUS,
      prioridades: ROTULO_PRIORIDADE,
      checklist_vistoria: [...ITENS_CHECKLIST],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(dados, null, 2) }],
      structuredContent: dados,
    };
  },
});
