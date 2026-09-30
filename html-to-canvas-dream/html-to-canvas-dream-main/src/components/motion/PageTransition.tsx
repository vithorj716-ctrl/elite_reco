import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { getGsap, prefersReducedMotion } from "@/lib/motion";

/**
 * Wraps route content and plays a soft reveal whenever the pathname changes.
 * Ready for future pages (product, atelier, journal) without extra wiring.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    if (!ref.current || prefersReducedMotion()) return;
    const { gsap } = getGsap();
    const tween = gsap.fromTo(
      ref.current,
      { autoAlpha: 0, y: 24, clipPath: "inset(6% 0% 0% 0%)" },
      { autoAlpha: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "expo.out", clearProps: "clipPath,transform" },
    );
    return () => void tween.kill();
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}
