import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from "react";

import { getGsap, prefersReducedMotion } from "@/lib/motion";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Runs GSAP code inside a scoped gsap.context and reverts every tween and
 * ScrollTrigger on unmount. The callback is skipped under reduced motion,
 * so content always stays visible by default.
 */
export function useGsap(
  setup: (scope: HTMLElement) => void,
  scope: RefObject<HTMLElement | null>,
  deps: DependencyList = [],
) {
  useIsoLayoutEffect(() => {
    const el = scope.current;
    if (!el || prefersReducedMotion()) return;
    const { gsap } = getGsap();
    const ctx = gsap.context(() => setup(el), el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
