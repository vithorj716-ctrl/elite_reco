import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Native scroll-snap carousel: touch swipe, mouse drag, arrow keys, buttons and indicators.
 * Children are the slides; size them with `itemClassName` so the next one peeks in.
 */
export function Slider({
  children,
  label,
  itemClassName,
  className,
  controlsClassName,
  autoplay = true,
  interval = 3500,
}: {
  children: ReactNode[];
  label: string;
  itemClassName?: string;
  className?: string;
  controlsClassName?: string;
  autoplay?: boolean;
  interval?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const count = children.length;

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft;
    let idx = 0;
    items.forEach((item, i) => {
      if (Math.abs(item.offsetLeft - el.offsetLeft - left) < Math.abs((items[idx]?.offsetLeft ?? 0) - el.offsetLeft - left)) idx = i;
    });
    activeRef.current = idx;
    setActive(idx);
  }, []);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el || count === 0) return;
    const normalized = (i + count) % count;
    const item = el.children[normalized] as HTMLElement | undefined;
    if (item) {
      activeRef.current = normalized;
      setActive(normalized);
      el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: "smooth" });
    }
  }, [count]);

  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [update]);

  useEffect(() => {
    if (!autoplay || count < 2) return undefined;
    const phase = (label.length * 137) % 420;
    let intervalTimer: number | null = null;
    const startTimer = window.setTimeout(() => {
      goTo(activeRef.current + 1);
      intervalTimer = window.setInterval(() => goTo(activeRef.current + 1), interval);
    }, interval + phase);
    return () => {
      window.clearTimeout(startTimer);
      if (intervalTimer !== null) window.clearInterval(intervalTimer);
    };
  }, [autoplay, count, goTo, interval, label]);

  // Mouse drag (touch already scrolls natively).
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.scrollLeft = d.left - dx;
    }
  };
  const endDrag = () => {
    const el = track.current;
    if (!drag.current || !el) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) {
      el.style.scrollSnapType = "";
      goTo(activeRef.current);
      const block = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
      el.addEventListener("click", block, { capture: true, once: true });
      setTimeout(() => el.removeEventListener("click", block, { capture: true }), 0);
    }
  };

  return (
    <div
      className={className}
      role="region"
      aria-roledescription="carrossel"
      aria-label={label}
    >
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); goTo(activeRef.current + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); goTo(activeRef.current - 1); }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        data-lenis-prevent-wheel=""
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 outline-none md:gap-6 md:scroll-px-10 md:px-10 [&_img]:select-none [&_img]:[-webkit-user-drag:none] cursor-grab active:cursor-grabbing"
      >
        {children.map((child, i) => (
          <div key={i} className={cn("shrink-0 snap-start", itemClassName)} aria-roledescription="slide" aria-label={`${i + 1} de ${count}`}>
            {child}
          </div>
        ))}
      </div>
      <div className={cn("mt-8 flex items-center justify-between gap-6 px-5 md:px-10", controlsClassName)}>
        <div className="flex items-center gap-2" aria-hidden="true">
          {children.map((_, i) => (
            <Button
              key={i}
              variant="ghost"
              size="icon"
              type="button"
              tabIndex={-1}
              onClick={() => goTo(i)}
              className="h-6 w-auto min-w-3 px-0"
            >
              <span className={cn("block h-[2px] rounded-full transition-all duration-500", i === active ? "w-8 bg-signature" : "w-3 bg-foreground/20")} />
            </Button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button data-carousel-arrow variant="icon" size="icon" type="button" aria-label="Anterior" onClick={() => goTo(activeRef.current - 1)} className="size-12 rounded-full border-2 border-foreground bg-foreground text-background shadow-lg opacity-100 hover:border-wine hover:bg-wine hover:text-primary-foreground">
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Button>
          <Button data-carousel-arrow variant="icon" size="icon" type="button" aria-label="Próximo" onClick={() => goTo(activeRef.current + 1)} className="size-12 rounded-full border-2 border-foreground bg-foreground text-background shadow-lg opacity-100 hover:border-wine hover:bg-wine hover:text-primary-foreground">
            <ArrowRight className="size-5" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  );
}
