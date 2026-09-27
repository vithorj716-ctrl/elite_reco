import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSessao } from "@/lib/sessao";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recolhe — Sistema de gestão de recolhimentos" },
      {
        name: "description",
        content:
          "Acesso ao sistema operacional de recolhimentos: fila de ordens, agentes em campo, evidências e histórico.",
      },
      { property: "og:title", content: "Recolhe — Sistema de gestão de recolhimentos" },
      {
        property: "og:description",
        content: "Fila operacional, distribuição para agentes, evidências fotográficas e histórico auditado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrada,
});

function destinoPor(papel: string) {
  if (papel === "agente") return "/agente";
  if (papel === "cliente") return "/portal";
  return "/dashboard";
}

function Entrada() {
  const { usuario, carregando } = useSessao();
  const navigate = useNavigate();

  useEffect(() => {
    if (carregando) return;
    navigate({ to: usuario ? destinoPor(usuario.papel) : "/entrar", replace: true });
  }, [usuario, carregando, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        carregando operação…
      </span>
    </div>
  );
}
