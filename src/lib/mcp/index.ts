import { defineMcp } from "@lovable.dev/mcp-js";
import referenciaSistema from "./tools/referencia-sistema";

export default defineMcp({
  name: "enchanted-interfaces",
  title: "Enchanted Interfaces",
  version: "0.1.0",
  instructions:
    "Ferramentas públicas de referência do sistema de gestão de recolhimentos de motocicletas. Expõem apenas dados de configuração (status, prioridades e checklist). Os serviços e preços são configuráveis no banco e não são publicados aqui. Não há acesso a ordens, clientes ou agentes reais.",
  tools: [referenciaSistema],
});
