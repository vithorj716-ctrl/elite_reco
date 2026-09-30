import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

import { revealSection } from "@/animations/reveal";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/carousel-snap";
import { categories, collections, editorialLooks, formatPrice, products, socials } from "@/data/site";
import { useGsap } from "@/hooks/use-gsap";

export function Categories() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  const card = (c: (typeof categories)[number], i: number) => (
    <a href="#mais-desejados" className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        <img data-drift={i % 2 ? "right" : "left"} src={c.image} alt={`Corset ${c.title}`} width={1395} height={1600} loading="lazy" decoding="async" className="catalog-photo size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02]" />
        <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-brass transition-transform duration-700 group-hover:scale-x-100" />
        <span className="absolute left-4 top-4 text-[9px] tracking-[0.2em] text-primary-foreground opacity-70">0{i + 1}</span>
      </div>
      <div className="mt-5 transition-transform duration-700 group-hover:translate-x-1.5">
        <p className="text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">{c.detail}</p>
        <h3 className="mt-2 font-display text-3xl">{c.title}</h3>
        <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{c.note}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] group-hover:text-magenta">Ver modelos <ArrowUpRight className="size-3.5" strokeWidth={1.4} /></span>
      </div>
    </a>
  );
  return (
    <section id="corsets" ref={ref} className="py-28 md:py-40">
      <SectionHeading eyebrow="Silhuetas" title={<>Encontre seu <em className="font-normal">corset</em></>} className="mx-auto mb-14 max-w-7xl px-5 md:px-10">
        Quatro formas de estruturar o corpo, cada uma construída a partir das suas medidas.
      </SectionHeading>
      <div className="mx-auto hidden max-w-7xl grid-cols-4 gap-6 px-10 md:grid">
        {categories.map((c, i) => <div key={c.title} data-reveal>{card(c, i)}</div>)}
      </div>
      <Slider label="Categorias" className="md:hidden" itemClassName="w-[78%]">
        {categories.map((c, i) => <div key={c.title}>{card(c, i)}</div>)}
      </Slider>
    </section>
  );
}

export function BestSellers() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section id="mais-desejados" ref={ref} className="bg-card py-28 md:py-40">
      <SectionHeading eyebrow="Best sellers" title={<>Mais <em className="font-normal">desejados</em></>} className="mx-auto mb-12 max-w-7xl px-5 md:px-10">
        Parcelamento em até 6x sem juros e produção sob medida em todas as peças.
      </SectionHeading>
      <div className="mx-auto max-w-[1440px]">
        <Slider label="Produtos mais desejados" itemClassName="w-[72%] sm:w-[44%] lg:w-[23%]">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </Slider>
      </div>
    </section>
  );
}

export function EditorialBanner() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section ref={ref} aria-label="Editorial Bekas" className="overflow-hidden bg-hero py-28 text-hero-foreground md:py-40">
      <div className="mx-auto mb-10 flex max-w-7xl items-end justify-between gap-8 px-5 md:px-10">
        <div>
          <p data-reveal className="text-[10px] uppercase tracking-[0.3em] text-hero-foreground/55">Bekas em movimento</p>
          <h2 data-reveal className="mt-4 max-w-3xl font-display text-4xl leading-none md:text-6xl">A peça ganha vida <em className="font-normal text-signature">em você.</em></h2>
        </div>
        <Button variant="outlineHero" asChild className="hidden md:inline-flex">
          <a href={socials.instagram} target="_blank" rel="noopener noreferrer">Ver no Instagram <ArrowUpRight className="size-4" /></a>
        </Button>
      </div>
      <Slider label="Editorial com modelos" interval={1400} itemClassName="w-[78%] sm:w-[48%] lg:w-[30%]" controlsClassName="text-hero-foreground [&_button[data-carousel-arrow]]:border-hero-foreground [&_button[data-carousel-arrow]]:bg-hero-foreground [&_button[data-carousel-arrow]]:text-hero [&_button[data-carousel-arrow]:hover]:border-brass [&_button[data-carousel-arrow]:hover]:bg-brass [&_button[data-carousel-arrow]:hover]:text-hero [&_span.bg-foreground\/20]:bg-hero-foreground/25">
        {editorialLooks.map((look, index) => (
          <a key={look.image} href={socials.instagram} target="_blank" rel="noopener noreferrer" className="group block">
            <div className="relative aspect-[3/4] max-h-[520px] overflow-hidden bg-graphite">
              <img src={look.image} alt={look.alt} width={1320} height={1600} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="catalog-photo size-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-hero/85 to-transparent px-6 pb-6 pt-24">
                <span className="block font-display text-3xl">{look.label}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-hero-foreground/65">{look.note}</span>
              </span>
              <span className="absolute right-5 top-5 font-display text-sm text-hero-foreground/65">0{index + 1}</span>
            </div>
          </a>
        ))}
      </Slider>
    </section>
  );
}

export function Collections() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  const [essentials, signature, romantic, statement, custom] = collections;
  const tile = (c: (typeof collections)[number] | undefined, cls: string, ratio: string) =>
    c && (
      <a href="#mais-desejados" className={`group relative block ${cls}`}>
        <div data-reveal-mask className={`relative overflow-hidden bg-muted ${ratio}`}>
          <img data-drift="right" src={c.image} alt={`Coleção ${c.name}`} loading="lazy" decoding="async" width={1395} height={1600} className="catalog-photo size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="font-display text-3xl transition-colors group-hover:text-magenta md:text-4xl">{c.name}</h3>
          <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" strokeWidth={1.3} />
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{c.note}</p>
      </a>
    );
  return (
    <section id="colecoes" ref={ref} className="py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <SectionHeading eyebrow="Coleções" title={<>Explore nossas <em className="font-normal">coleções</em></>} className="mb-16">
          Cinco universos, uma mesma assinatura: técnica artesanal e silhueta que transforma.
        </SectionHeading>
        <div className="grid gap-x-8 gap-y-14 md:grid-cols-12 md:gap-y-16">
          {tile(signature, "md:col-span-7", "aspect-[16/11]")}
          {tile(romantic, "md:col-span-5", "aspect-[16/11]")}
          {tile(essentials, "md:col-span-4", "aspect-[4/3]")}
          {tile(statement, "md:col-span-4", "aspect-[4/3]")}
          {tile(custom, "md:col-span-4", "aspect-[4/3]")}
        </div>
      </div>
    </section>
  );
}

export function Featured() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  const product = products.find((p) => p.isFeatured) ?? products[0];
  if (!product) return null;
  return (
    <section ref={ref} className="bg-hero text-hero-foreground">
      <div className="mx-auto grid max-w-[1440px] md:grid-cols-2">
        <div className="relative h-[54svh] min-h-[420px] max-h-[620px] overflow-hidden md:h-[640px]">
          <img data-parallax="4" src={product.image} alt={product.name} loading="lazy" decoding="async" width={1395} height={1600} className="catalog-photo absolute inset-0 h-[104%] w-full object-cover" />
        </div>
        <div className="relative flex flex-col justify-center px-6 py-20 md:px-16 lg:px-24">
          <span className="absolute left-0 top-0 h-full w-[3px] bg-signature" aria-hidden="true" />
          <p data-reveal className="text-[10px] uppercase tracking-[0.3em] text-hero-foreground/60">Peça em destaque · {product.badge}</p>
          <h2 data-reveal className="mt-6 font-display text-5xl leading-none md:text-7xl">Cetim <em className="font-normal text-signature">Off-white</em></h2>
          <p data-reveal className="mt-8 max-w-md text-[14px] leading-7 text-hero-foreground/75">
            Cetim acetinado sobre estrutura de barbatanas, bojo estruturado e modelagem tomara que caia que valoriza a silhueta.
          </p>
          <dl data-reveal className="mt-10 grid max-w-md grid-cols-3 gap-6 border-y border-hero-foreground/15 py-6 text-[11px]">
            <div><dt className="text-hero-foreground/50">Tecido</dt><dd className="mt-1">Cetim acetinado</dd></div>
            <div><dt className="text-hero-foreground/50">Estrutura</dt><dd className="mt-1">16 barbatanas</dd></div>
            <div><dt className="text-hero-foreground/50">Prazo</dt><dd className="mt-1">25 dias úteis</dd></div>
          </dl>
          <p data-reveal className="mt-8 font-display text-4xl tabular-nums">{formatPrice(product.price)}</p>
          <p data-reveal className="mt-1 text-[12px] text-hero-foreground/60">ou {product.installments}x de {formatPrice(product.price / product.installments)} sem juros</p>
          <div data-reveal className="mt-10">
            <Button variant="outlineHero" asChild><a href="#sob-medida">Quero a minha</a></Button>
          </div>
        </div>
      </div>
    </section>
  );
}


