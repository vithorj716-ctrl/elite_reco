import { Instagram } from "lucide-react";
import { useEffect, useState } from "react";

import { Butterfly } from "@/components/brand/Butterfly";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { Button } from "@/components/ui/button";
import { navigation, socials } from "@/data/site";
import { cn } from "@/lib/utils";

/** Sticky header: compacts after scrolling, hides going down, returns instantly going up. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        if (Math.abs(y - last) > 6) setHidden(y > last && y > 320);
        last = y;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[transform,background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled ? "border-border/70 bg-background/95" : "border-transparent bg-background",
          hidden && !menuOpen && "-translate-y-full",
        )}
      >
        <div className={cn("mx-auto grid max-w-7xl grid-cols-3 items-center px-5 transition-[height] duration-500 md:px-10", scrolled ? "h-16" : "h-20 md:h-24")}>
          <div className="flex items-center gap-1" />

          <a href="#inicio" className="group mx-auto flex items-center gap-3" aria-label="Bekas, início">
            <Butterfly beat="hover" className={cn("transition-[width] duration-500", scrolled ? "w-8" : "w-10")} />
            <span className="hidden font-display text-lg font-medium tracking-[0.04em] sm:block">Bekas</span>
          </a>

          <div className="flex items-center justify-end gap-1">
            <Button variant="icon" size="icon" asChild className="hidden sm:inline-flex">
              <a href={socials.instagram} target="_blank" rel="noopener noreferrer me" aria-label="Instagram da Bekas (abre em nova aba)"><Instagram className="size-[18px]" strokeWidth={1.3} /></a>
            </Button>
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex size-11 flex-col items-center justify-center gap-[5px] md:hidden"
            >
              <span className="h-px w-6 bg-foreground" /><span className="h-px w-4 self-end bg-foreground mr-2.5" />
            </button>
          </div>
        </div>

        <nav aria-label="Principal" className={cn("hidden items-center justify-center gap-10 text-[10.5px] uppercase tracking-[0.16em] transition-[height,opacity] duration-500 md:flex", scrolled ? "h-0 overflow-hidden opacity-0" : "h-11 opacity-100")}>
          {navigation.map((item) => (
            <a key={item.label} href={item.href} className="link-line">{item.label}</a>
          ))}
        </nav>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
