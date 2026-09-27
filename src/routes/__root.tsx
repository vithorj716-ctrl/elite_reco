import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ProvedorSessao } from "@/lib/sessao";
import { Toaster } from "@/components/ui/sonner";
import { ScrollSuave } from "@/components/app/scroll-suave";
import { AnimatedVideoBackground } from "@/components/app/fundo-video";
import { registrarServiceWorker } from "@/lib/pwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Erro 404</p>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.06em] text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="press mt-6 inline-flex items-center bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-destructive">Falha</p>
        <h1 className="mt-3 font-display text-2xl uppercase tracking-[0.06em] text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado por aqui. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="press bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a href="/" className="press border border-border-strong px-4 py-2 text-sm text-foreground">
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Recolhe — Gestão de recolhimentos de motocicletas" },
      {
        name: "description",
        content:
          "Plataforma para locadoras e equipes de campo controlarem recolhimentos de motocicletas de ponta a ponta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0b0b0c" },
      { name: "application-name", content: "Recolhe" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Recolhe" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void registrarServiceWorker();
  }, []);



  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorSessao>
        <ScrollSuave />
        <AnimatedVideoBackground />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster theme="dark" position="top-right" closeButton expand={false} style={{ "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", "--normal-border": "var(--border-strong)" } as React.CSSProperties} toastOptions={{ classNames: { toast: "border border-border-strong bg-popover text-popover-foreground shadow-cromo rounded-none", title: "font-medium text-[13px]", description: "text-muted-foreground text-[12px]", success: "border-l-2 border-l-primary", error: "border-l-2 border-l-destructive" } }} />
      </ProvedorSessao>
    </QueryClientProvider>
  );
}
