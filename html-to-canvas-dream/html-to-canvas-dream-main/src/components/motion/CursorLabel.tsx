import { useEffect, useRef, useState } from "react";

import { getGsap, isFinePointer, prefersReducedMotion } from "@/lib/motion";

/**
 * Small circular label that follows the pointer only over elements marked
 * with data-cursor="Label". Desktop / fine pointers only.
 */
export function CursorLabel() {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => setEnabled(isFinePointer() && !prefersReducedMotion()), []);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const { gsap } = getGsap();
    const xTo = gsap.quickTo(el, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.55, ease: "power3.out" });
    let active: Element | null = null;

    const onMove = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      const target = (e.target as Element | null)?.closest?.("[data-cursor]") ?? null;
      if (target === active) return;
      active = target;
      if (target) setLabel(target.getAttribute("data-cursor") ?? "");
      gsap.to(el, { scale: target ? 1 : 0, autoAlpha: target ? 1 : 0, duration: 0.45, ease: "power3.out" });
    };
    gsap.set(el, { scale: 0, autoAlpha: 0, xPercent: -50, yPercent: -50 });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[60] flex size-20 items-center justify-center rounded-full bg-hero-foreground/90 text-[9px] font-medium uppercase tracking-[0.22em] text-hero mix-blend-normal"
    >
      {label}
    </div>
  );
}
