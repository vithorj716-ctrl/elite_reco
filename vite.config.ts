// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

// On Vercel, nitro auto-detects the "vercel" preset and emits static files to .vercel/output/static.
const NA_VERCEL = !!process.env.VERCEL && !process.env.LOVABLE_NITRO_PRESET;
const PASTA_CLIENTE = NA_VERCEL ? ".vercel/output/static" : "dist/client";

export default defineConfig({
  ...(NA_VERCEL ? { nitro: { preset: "vercel" } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      mcpPlugin(),
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        outDir: "dist/client",
        devOptions: { enabled: false },
        manifest: {
          id: "/",
          name: "Recolhe — Gestão de recolhimentos",
          short_name: "Recolhe",
          description:
            "Operação de recolhimento de motocicletas: fila de ordens, agentes em campo, evidências e financeiro.",
          lang: "pt-BR",
          dir: "ltr",
          start_url: "/",
          scope: "/",
          display: "standalone",
          display_override: ["standalone", "minimal-ui", "browser"],
          orientation: "portrait-primary",
          theme_color: "#0b0b0c",
          background_color: "#0b0b0c",
          categories: ["business", "productivity"],
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            { name: "Operação do dia", short_name: "Operação", url: "/operacao" },
            { name: "Fila de ordens", short_name: "Ordens", url: "/ordens" },
            { name: "Meus recolhimentos", short_name: "Agente", url: "/agente" },
          ],
        },
        workbox: {
          globDirectory: "dist/client",
          importScripts: ["/push-sw.js"],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-navegacao",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                url.origin === self.location.origin &&
                ["script", "style", "font", "image"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "estaticos-app",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
