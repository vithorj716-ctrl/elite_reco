import { Instagram, Quote, Ruler } from "lucide-react";
import { useRef } from "react";

import { revealSection } from "@/animations/reveal";
import { Butterfly, beatOnce } from "@/components/brand/Butterfly";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/carousel-snap";
import { benefits, gallery, images, posts, process, socials, testimonials } from "@/data/site";
import { useGsap } from "@/hooks/use-gsap";
import { EASE, getGsap } from "@/lib/motion";

export function BenefitsStrip() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section ref={ref} aria-label="Benefícios" className="border-y border-border">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-5">
        {benefits.map((b, i) => (
          <li key={b} data-reveal className="flex items-center gap-3 border-border px-5 py-7 text-[10px] uppercase tracking-[0.2em] [&:not(:last-child)]:border-r max-md:[&:nth-child(2n)]:border-r-0 max-md:border-b md:justify-center md:border-b-0">
            <span className="size-1.5 shrink-0 rotate-45 bg-signature" aria-hidden="true" />
            <span className="sr-only">{i + 1}. </span>{b}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CustomProcess() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => {
    revealSection(s);
    const { gsap } = getGsap();
    gsap.fromTo("[data-line]", { scaleX: 0, scaleY: 0 }, { scaleX: 1, scaleY: 1, ease: "none", scrollTrigger: { trigger: "[data-timeline]", start: "top 75%", end: "bottom 55%", scrub: true } });
    const fly = s.querySelector("[data-section-fly] .butterfly");
    gsap.timeline({ scrollTrigger: { trigger: s, start: "top 60%", once: true, onEnter: () => beatOnce(fly) } });
  }, ref);
  return (
    <section id="sob-medida" ref={ref} className="relative py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <div data-section-fly className="mb-10 w-12"><Butterfly beat="none" /></div>
        <SectionHeading eyebrow="Sob medida" title={<>Seu corpo. <em className="font-normal text-signature">Seu corset.</em></>} className="mb-20">
          Nada de tamanhos padrão. Cada molde nasce das suas medidas, e cada detalhe é decidido com você.
        </SectionHeading>
        <ol data-timeline className="relative grid gap-12 md:grid-cols-4 md:gap-8">
          <span className="absolute left-[7px] top-0 h-full w-px bg-border md:left-0 md:top-[7px] md:h-px md:w-full" aria-hidden="true" />
          <span data-line className="absolute left-[7px] top-0 h-full w-px origin-top bg-signature md:left-0 md:top-[7px] md:h-px md:w-full md:origin-left" aria-hidden="true" />
          {process.map((p) => (
            <li key={p.step} data-reveal className="relative pl-10 md:pl-0 md:pt-12">
              <span className="absolute left-0 top-1 size-[15px] rounded-full border border-magenta bg-background md:top-0" aria-hidden="true" />
              <span className="font-display text-5xl text-muted-foreground/40">{p.step}</span>
              <h3 className="mt-3 font-display text-2xl">{p.title}</h3>
              <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ol>
        <div data-reveal className="mt-16"><Button variant="signature" asChild><a href="#guia"><span>Começar meu sob medida</span></a></Button></div>
      </div>
    </section>
  );
}

export function Atelier() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section id="sobre" ref={ref} className="bg-card py-28 md:py-40">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-12 md:px-10">
        <div data-reveal-mask className="relative aspect-[4/3] overflow-hidden md:col-span-7">
          <img src={images.detailImage} alt="Detalhe de amarração de cetim e ilhoses sobre bancada do atelier" loading="lazy" width={1152} height={896} className="size-full object-cover" />
        </div>
        <div className="flex flex-col justify-center md:col-span-4 md:col-start-9">
          <p data-reveal className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">O atelier</p>
          <h2 data-reveal className="mt-5 font-display text-4xl leading-tight md:text-5xl">Feito à mão, <em className="font-normal">ponto por ponto.</em></h2>
          <p data-reveal className="mt-6 text-[13px] leading-7 text-muted-foreground">Unimos técnicas históricas de corsetaria a uma modelagem contemporânea. Cada peça passa por mais de 40 horas de trabalho: molde, corte, estrutura, costura e acabamento.</p>
          <dl data-reveal className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[["40h", "por peça"], ["16", "barbatanas"], ["100%", "artesanal"]].map(([n, l]) => (
              <div key={l}><dt className="font-display text-3xl text-signature">{n}</dt><dd className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section ref={ref} className="py-28 md:py-40">
      <SectionHeading eyebrow="Depoimentos" title={<>Quem veste, <em className="font-normal">sente.</em></>} className="mx-auto mb-14 max-w-7xl px-5 md:px-10" />
      <div className="mx-auto max-w-[1440px]">
        <Slider label="Depoimentos de clientes" itemClassName="w-[86%] md:w-[46%] lg:w-[38%]">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex h-full flex-col justify-between border border-border bg-card p-8 md:p-10">
              <Quote className="size-6 text-magenta" strokeWidth={1.2} />
              <blockquote className="mt-6 font-display text-2xl leading-snug md:text-[1.7rem]">“{t.text}”</blockquote>
              <figcaption className="mt-10 flex items-center gap-4">
                <img src={t.image} alt="" loading="lazy" width={96} height={96} className="size-12 rounded-full object-cover" />
                <span><span className="block text-[13px]">{t.name}</span><span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.piece}</span></span>
              </figcaption>
            </figure>
          ))}
        </Slider>
      </div>
    </section>
  );
}

export function Gallery() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section ref={ref} className="py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <SectionHeading eyebrow="Instagram" title={<><em className="font-normal text-signature">{socials.instagramHandle}</em> de perto.</>} className="mb-12">
          Looks reais, detalhes de construção e bastidores do atelier. Acompanhe o dia a dia no Instagram.
        </SectionHeading>
        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[240px] md:grid-cols-4 md:gap-4">
          {gallery.map((g) => (
            <a key={g.alt} href={socials.instagram} target="_blank" rel="noopener noreferrer" data-reveal className={`group relative overflow-hidden bg-muted ${g.span}`}>
              <img src={g.image} alt={g.alt} loading="lazy" width={600} height={800} className="size-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.05]" />
              <span className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-hero/60 to-transparent p-4 text-[10px] uppercase tracking-[0.2em] text-hero-foreground opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
                Ver look<Instagram className="size-4" strokeWidth={1.3} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Journal() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  const card = (p: (typeof posts)[number]) => (
    <a href="#blog" className="group block">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img src={p.image} alt="" loading="lazy" width={800} height={600} className="size-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.05]" />
      </div>
      <p className="mt-5 flex justify-between text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground"><span className="text-magenta">{p.category}</span><span>{p.date}</span></p>
      <h3 className="mt-3 font-display text-2xl leading-tight transition-colors group-hover:text-magenta">{p.title}</h3>
      <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{p.excerpt}</p>
      <span className="link-line mt-4 text-[10px] uppercase tracking-[0.2em]">Ler artigo</span>
    </a>
  );
  return (
    <section id="blog" ref={ref} className="bg-card py-28 md:py-40">
      <SectionHeading eyebrow="Journal" title={<>Conteúdos para <em className="font-normal">vestir melhor</em></>} className="mx-auto mb-14 max-w-7xl px-5 md:px-10" />
      <div className="mx-auto hidden max-w-7xl grid-cols-4 gap-8 px-10 md:grid">
        {posts.map((p) => <div key={p.title} data-reveal>{card(p)}</div>)}
      </div>
      <Slider label="Artigos" className="md:hidden" itemClassName="w-[80%]">
        {posts.map((p) => <div key={p.title}>{card(p)}</div>)}
      </Slider>
    </section>
  );
}

export function SizeGuide() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section id="guia" ref={ref} className="py-28 md:py-40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:px-10">
        <div>
          <p data-reveal className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Guia de medidas</p>
          <h2 data-reveal className="mt-5 font-display text-4xl leading-tight md:text-6xl">Seu tamanho perfeito <em className="font-normal">começa aqui.</em></h2>
          <p data-reveal className="mt-6 max-w-md text-[13px] leading-7 text-muted-foreground">Três medidas, uma fita métrica e cinco minutos. Nós cuidamos do resto.</p>
          <div data-reveal className="mt-10"><Button variant="line" asChild><a href="#faq"><Ruler className="size-4" strokeWidth={1.3} />Ver guia de medidas</a></Button></div>
        </div>
        <ol className="grid gap-3">
          {[["Busto", "Na parte mais cheia, com a fita paralela ao chão."], ["Cintura", "No ponto mais estreito, cerca de 3 cm acima do umbigo."], ["Quadril", "Na parte mais larga, mantendo os pés juntos."]].map(([t, d], i) => (
            <li key={t} data-reveal className="group flex items-center gap-6 border border-border bg-card p-6 transition-colors hover:border-magenta">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-signature font-display text-xl text-primary-foreground">{i + 1}</span>
              <span><span className="block font-display text-2xl">{t}</span><span className="block text-[12.5px] text-muted-foreground">{d}</span></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => {
    revealSection(s);
    const { gsap } = getGsap();
    const fly = s.querySelector<HTMLElement>("[data-cta-fly]");
    if (!fly) return;
    const wings = fly.querySelectorAll(".wing-l, .wing-r");
    gsap.set(fly, { autoAlpha: 0, y: 40, scale: 0.8 });
    gsap.set(wings, { scaleX: 0.15 });
    gsap.timeline({ scrollTrigger: { trigger: s, start: "top 65%", once: true } })
      .to(fly, { autoAlpha: 1, y: 0, scale: 1, duration: 1.4, ease: EASE.enter })
      .to(wings, { scaleX: 1, duration: 1.2, ease: "power2.out", stagger: 0.06 }, 0.3)
      .add(() => { gsap.set(wings, { clearProps: "transform" }); beatOnce(fly.querySelector(".butterfly")); }, 1.6)
      .to(fly, { x: 18, y: -10, rotate: 4, duration: 2.4, ease: "sine.inOut" }, 1.6);
  }, ref);
  return (
    <section ref={ref} className="relative overflow-hidden bg-hero px-5 py-28 text-center text-hero-foreground md:py-44">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[60vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signature opacity-[0.12] blur-[120px]" aria-hidden="true" />
      <div data-cta-fly className="relative mx-auto mb-10 w-24 md:w-32"><Butterfly beat="none" /></div>
      <h2 data-reveal className="relative mx-auto max-w-4xl font-display text-5xl leading-[0.98] md:text-8xl">Pronta para vestir <em className="font-normal text-signature">sua essência?</em></h2>
      <div data-reveal className="relative mt-12 flex flex-wrap items-center justify-center gap-4">
        <Button variant="outlineHero" asChild><a href="#mais-desejados">Explorar coleção</a></Button>
        <a
          href={socials.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 border border-hero-foreground/40 px-6 py-3 text-[10px] uppercase tracking-[0.22em] transition-colors hover:border-hero-foreground hover:bg-hero-foreground/10"
        >
          <Instagram className="size-4" strokeWidth={1.3} aria-hidden="true" />
          Seguir no Instagram
        </a>
      </div>
    </section>
  );
}
