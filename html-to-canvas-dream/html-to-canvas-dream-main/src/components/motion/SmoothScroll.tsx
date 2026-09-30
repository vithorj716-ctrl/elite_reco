import Lenis from "lenis";
import { useEffect } from "react";

import { getGsap, isFinePointer, prefersReducedMotion } from "@/lib/motion";

let lenis: Lenis | null = null;

/** Access to the shared Lenis instance (null when native scroll is used). */
export const getLenis = () => lenis;

export function lockScroll(locked: boolean) {
  if (lenis) (locked ? lenis.stop() : lenis.start());
  document.documentElement.style.overflow = locked ? "hidden" : "";
}

/** Premium smooth scrolling, synced to GSAP's ticker. Falls back to native scroll on reduced motion and touch. */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion() || !isFinePointer()) return;
    const { gsap, ScrollTrigger } = getGsap();
    lenis = new Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3.2), anchors: { offset: -64 }, syncTouch: false });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
  return null;
}
