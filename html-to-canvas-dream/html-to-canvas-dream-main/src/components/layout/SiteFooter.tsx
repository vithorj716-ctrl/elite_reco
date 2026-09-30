import { Instagram, Music2, Pin } from "lucide-react";
import { useRef } from "react";

import { revealSection } from "@/animations/reveal";
import { Butterfly } from "@/components/brand/Butterfly";
import { footerLinks, socials } from "@/data/site";
import { useGsap } from "@/hooks/use-gsap";

const hrefFor = (label: string) =>
  ({ Corsets: "#corsets", Coleções: "#colecoes", Novidades: "#mais-desejados", "Mais vendidos": "#mais-desejados", "Guia de medidas": "#guia", FAQ: "#faq", Trocas: "#faq", "Sob medida": "#sob-medida", Atelier: "#sobre", "A marca": "#sobre", Blog: "#blog", Instagram: socials.instagram } as Record<string, string>)[label] ?? "#contato";

export function SiteFooter() {
  const ref = useRef<HTMLElement>(null);
  useGsap((scope) => revealSection(scope), ref);

  return (
    <footer id="contato" ref={ref} className="border-t border-border px-5 pb-24 pt-20 md:px-10 md:pb-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-14 border-b border-border pb-16 md:grid-cols-12">
          <div className="md:col-span-4">
            <a href="#inicio" className="group flex items-center gap-3" aria-label="Bekas, voltar ao início">
              <Butterfly beat="hover" className="w-10" />
              <span className="font-display text-2xl">Bekas</span>
            </a>
            <p data-reveal className="mt-6 max-w-xs text-[12.5px] leading-6 text-muted-foreground">Corseteria autoral brasileira. Peças sob medida, feitas à mão para transformar presença.</p>
            <a
              data-reveal
              href={socials.instagram}
              target="_blank"
              rel="noopener noreferrer me"
              className="mt-8 inline-flex items-center gap-3 border border-border px-5 py-3 text-[10px] uppercase tracking-[0.22em] transition-colors hover:border-magenta hover:text-magenta"
            >
              <Instagram className="size-4" strokeWidth={1.3} aria-hidden="true" />
              {socials.instagramHandle}
            </a>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:col-span-8">
            {footerLinks.map((col) => (
              <div key={col.title}>
                <p data-reveal className="mb-5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{col.title}</p>
                <ul className="space-y-3 text-[12.5px]">
                  {col.links.map((l) => (
                    <li key={l} data-reveal>{col.title === "Redes" ? (
                      <a className="inline-flex items-center gap-2 hover:text-wine transition-colors" href={hrefFor(l)} target={l === "Instagram" ? "_blank" : undefined} rel={l === "Instagram" ? "noopener noreferrer" : undefined} aria-label={l === "Instagram" ? "Instagram da Bekas (abre em nova aba)" : undefined}>
                        {l === "Instagram" ? <Instagram className="size-4" strokeWidth={1.3} aria-hidden="true" /> : l === "TikTok" ? <Music2 className="size-4" strokeWidth={1.3} aria-hidden="true" /> : <Pin className="size-4" strokeWidth={1.3} aria-hidden="true" />}
                        {l}
                      </a>
                    ) : <a className="link-line hover:text-magenta" href={hrefFor(l)}>{l}</a>}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-4 pt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© 2026 Bekas · 6x sem juros · Pix · Envio para todo Brasil</p>
          <div className="flex items-center gap-6">
            <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="link-line hover:text-magenta">Instagram ↗</a>
            <a href="#inicio" className="link-line self-start">Voltar ao topo ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
