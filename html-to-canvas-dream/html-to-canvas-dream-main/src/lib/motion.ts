import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Single entry point for GSAP so the plugin is registered once, client-side only. */
export function getGsap() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "expo.out", duration: 1.1 });
    registered = true;
  }
  return { gsap, ScrollTrigger };
}

/**
 * Motion is part of the brand experience, so the OS "reduce animations" flag
 * (often on by default on Windows desktops) no longer disables it.
 */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isFinePointer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Editorial easing vocabulary shared by every animation. */
export const EASE = {
  enter: "expo.out",
  soft: "power3.out",
  inOut: "power3.inOut",
} as const;
