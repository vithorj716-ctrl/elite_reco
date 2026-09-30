import { Instagram } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Butterfly } from "@/components/brand/Butterfly";
import { lockScroll } from "@/components/motion/SmoothScroll";
import { navigation, socials } from "@/data/site";
import { EASE, getGsap, prefersReducedMotion } from "@/lib/motion";

/** Fullscreen editorial menu with clip reveal and staggered links. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!mounted || !el) return undefined;
    const { gsap } = getGsap();
    const reduced = prefersReducedMotion();
    const links = el.querySelectorAll("[data-menu-item]");

    if (open) {
      lockScroll(true);
      closeRef.current?.focus();
      const tl = gsap.timeline();
      tl.fromTo(el, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: reduced ? 0 : 0.9, ease: EASE.inOut })
        .fromTo(links, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: reduced ? 0 : 0.9, ease: EASE.enter }, reduced ? 0 : 0.35);
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("keydown", onKey);
        tl.kill();
      };
    }
    lockScroll(false);
    gsap.to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: reduced ? 0 : 0.7, ease: EASE.inOut, onComplete: () => setMounted(false) });
    return undefined;
  }, [open, mounted, onClose]);

  if (!mounted) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-hero px-6 pb-10 pt-6 text-hero-foreground md:hidden">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3 font-display text-lg"><Butterfly beat="loop" className="w-9" />Bekas</span>
        <button ref={closeRef} type="button" onClick={onClose} className="-mr-2 px-2 py-3 text-[10px] uppercase tracking-[0.22em]">Fechar</button>
      </div>
      <nav aria-label="Menu móvel" className="mt-auto">
        <ul>
          {navigation.map((item, i) => (
            <li key={item.label} className="overflow-hidden border-b border-hero-foreground/15">
              <a data-menu-item href={item.href} onClick={onClose} className="flex items-baseline gap-4 py-4 font-display text-[2rem] leading-none">
                <span className="font-sans text-[9px] tracking-[0.2em] opacity-50">0{i + 1}</span>{item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div data-menu-item className="mt-10 flex justify-between text-[10px] uppercase tracking-[0.2em] opacity-70">
        <a href={socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram da Bekas (abre em nova aba)" className="inline-flex items-center gap-2 text-[12px]"><Instagram className="size-4" strokeWidth={1.3} aria-hidden="true" />Instagram</a>
        <a href="#contato" onClick={onClose}>Contato</a>
      </div>
    </div>
  );
}
