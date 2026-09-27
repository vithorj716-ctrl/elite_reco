import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { traduzirErro } from "./data/erros";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Padrões únicos de cache: antes cada consulta decidia sozinha, o que gerava
  // telas com dados velhos e recargas desnecessárias em ambiente multiusuário.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (tentativa, erro) => {
          const t = traduzirErro(erro);
          // Erro de permissão ou sessão não melhora com nova tentativa.
          if (t.contexto === "permissão" || t.contexto === "autenticação") return false;
          return tentativa < 3;
        },
        retryDelay: (t) => Math.min(4000, 400 * 2 ** t),
      },
      mutations: { retry: 0 },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 20,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
