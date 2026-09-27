import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registrado = false;

/**
 * Scroll suave global (Lenis) sincronizado com o ticker do GSAP,
 * para que o ScrollTrigger leia posições corretas.
 * Respeita prefers-reduced-motion e ignora áreas com data-lenis-prevent.
 */
export function ScrollSuave() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) return;

    if (!registrado) {
      gsap.registerPlugin(ScrollTrigger);
      registrado = true;
    }

    const lenis = new Lenis({
      duration: 0.9,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const ticker = (tempo: number) => lenis.raf(tempo * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, []);

  return null;
}
