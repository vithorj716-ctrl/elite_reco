import { useRef } from "react";

import { Butterfly, beatOnce } from "@/components/brand/Butterfly";
import { Button } from "@/components/ui/button";
import { images } from "@/data/site";
import { useGsap } from "@/hooks/use-gsap";
import { EASE, getGsap } from "@/lib/motion";

export function Hero() {
  const ref = useRef<HTMLElement>(null);

  useGsap((scope) => {
    const { gsap } = getGsap();
    const fly = scope.querySelector("[data-hero-fly]");
    const tl = gsap.timeline();
    tl.fromTo("[data-hero-frame]", { clipPath: "inset(4% 0% 4% 12%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: EASE.soft, clearProps: "clipPath" })
      .fromTo("[data-hero-img]", { scale: 1.035 }, { scale: 1.01, duration: 0.7, ease: EASE.soft }, 0)
      .fromTo("[data-hero-line]", { yPercent: 110 }, { yPercent: 0, duration: 0.8, stagger: 0.08, ease: EASE.enter }, 0.15)
      .fromTo(fly, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.soft, onComplete: () => beatOnce(fly?.querySelector(".butterfly") ?? null) }, 0.1)
      .fromTo("[data-hero-fade]", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: EASE.soft }, 0.35);

    const st = { trigger: scope, start: "top top", end: "bottom top", scrub: true };
    gsap.to("[data-hero-img]", { yPercent: 3, ease: "none", scrollTrigger: st });
  }, ref);

  return (
    <section id="inicio" ref={ref} className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-[1440px] md:min-h-[680px] md:grid-cols-12">
        <div className="relative z-10 order-2 flex flex-col justify-center px-6 pb-14 pt-10 md:order-1 md:col-span-6 md:px-12 md:py-20 lg:px-16">
          <div data-hero-fly className="mb-6 w-12 md:w-14">
            <Butterfly beat="none" title="BK" />
          </div>
          <p data-hero-fade className="mb-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-px w-8 bg-signature" />Coleção Metamorfose — 2026
          </p>
          <h1 className="font-display text-[3.4rem] font-medium leading-[0.92] tracking-[-0.015em] sm:text-7xl md:text-[5.5rem] lg:text-[6.8rem]">
            <span className="block overflow-hidden pb-1"><span data-hero-line className="block">Vista sua</span></span>
            <span className="block overflow-hidden pb-3"><span data-hero-line className="block italic font-normal text-signature md:pl-20">essência.</span></span>
          </h1>
          <p data-hero-fade className="mt-6 max-w-[24rem] text-[14px] leading-7 text-muted-foreground">
            Peças feitas para transformar presença, silhueta e expressão.
          </p>
          <div data-hero-fade className="mt-10 flex flex-wrap gap-3">
            <Button variant="signature" asChild><a href="#corsets"><span>Explorar coleção</span></a></Button>
            <Button variant="line" asChild><a href="#sobre">Conheça o atelier</a></Button>
          </div>
          <div data-hero-fade className="mt-14 hidden items-center gap-4 text-[10px] uppercase tracking-[0.26em] text-muted-foreground md:flex">
            <span className="relative h-10 w-px overflow-hidden bg-foreground/15"><span className="animate-scroll-cue absolute inset-x-0 top-0 h-1/2 bg-brass" /></span>
            Role para descobrir
          </div>
        </div>

        <div className="relative order-1 h-[52svh] min-h-[390px] max-h-[560px] md:order-2 md:col-span-6 md:h-[640px] md:max-h-none">
          <div data-hero-frame className="absolute inset-0 overflow-hidden bg-hero md:inset-y-6 md:right-4">
            <img data-hero-img src={images.heroImage} alt="Modelo vestindo corset jeans Bekas" width={1236} height={1600} fetchPriority="high" decoding="async" className="catalog-photo size-full scale-[1.01] object-cover object-[50%_20%] will-change-transform" />
          </div>
        </div>
      </div>
    </section>
  );
}
