<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the storefront as a frontend-only editorial showcase; product actions navigate within the page because no commerce backend is connected.
- All GSAP/ScrollTrigger usage goes through src/lib/motion.ts + useGsap (scoped context, auto revert); section reveals use src/animations/reveal.ts batches — keeps motion organized and leak-free.
- Lenis smooth scroll lives in SmoothScroll (root), synced to GSAP ticker, disabled under reduced motion — single scroll source of truth.
- Route content is wrapped in PageTransition in __root so future pages get transitions automatically.
- Brand logo is an inline SVG traced from the supplied BK artwork; its two vector symbols animate continuously as independent wings via CSS keyframes — keeps every placement crisp and consistent.
- The storefront brand name is Bekas everywhere, including visible copy, accessibility labels, and search metadata — keeps brand identity consistent.
- Carousels use independent, uninterrupted timers in src/components/ui/carousel-snap.tsx with a fast 1.6-second default cycle; pointer interaction never pauses autoplay.
- Product and content data live in src/data/site.ts; ProductCard renders only props so an API can replace the data later.
- Catalogue photos live in public/catalogo/*.webp (real photos, no AI images) so they load on Vercel too; reveals are short (<=0.6s) and trigger before entering view so fast scrolling never shows blank areas.
- Catalogue photos are gently upscaled and sharpened offline at high WebP quality; on-page motion avoids aggressive zoom so low-resolution model shots do not expose grain.
- Product cards show product-only imagery; model photography belongs in editorial banners and storytelling sections so the catalogue remains visually consistent.
