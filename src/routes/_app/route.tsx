import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "@/components/app/shell";
import { BloqueioSistema } from "@/components/app/bloqueio-sistema";
import { useSessao } from "@/lib/sessao";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { usuario, carregando } = useSessao();
  const navigate = useNavigate();

  useEffect(() => {
    if (!carregando && !usuario) navigate({ to: "/entrar", replace: true });
  }, [carregando, usuario, navigate]);

  if (carregando || !usuario) {
    return (
      <div className="flex min-h-dvh flex-col" role="status" aria-live="polite">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4 lg:px-6">
          <div className="h-5 w-28 animate-pulse bg-surface-raised" />
          <div className="ml-auto h-5 w-24 animate-pulse bg-surface-raised" />
        </div>
        <div className="flex flex-1">
          <div className="hidden w-[236px] shrink-0 flex-col gap-1.5 border-r border-sidebar-border p-4 lg:flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse bg-surface-raised"
                style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.08 }}
              />
            ))}
          </div>
          <div className="flex-1 space-y-4 p-6">
            <div className="h-7 w-52 animate-pulse bg-surface-raised" />
            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[86px] animate-pulse bg-surface" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
            <div className="h-64 animate-pulse border border-border bg-surface" />
          </div>
        </div>
        <span className="sr-only">Carregando operação…</span>
      </div>
    );
  }


  return (
    <>
      <Shell>
        <Outlet />
      </Shell>
      <BloqueioSistema />
    </>
  );
}
