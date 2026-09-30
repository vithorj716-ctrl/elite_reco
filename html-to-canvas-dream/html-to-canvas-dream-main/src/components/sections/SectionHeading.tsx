import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, children, className }: { eyebrow: string; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-12 md:items-end", className)}>
      <div className="md:col-span-7">
        <p data-reveal className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span className="h-px w-8 bg-signature" />{eyebrow}
        </p>
        <h2 data-reveal className="font-display text-[2.6rem] leading-[1] tracking-[-0.01em] md:text-6xl">{title}</h2>
      </div>
      {children && <div data-reveal className="text-[13px] leading-6 text-muted-foreground md:col-span-4 md:col-start-9">{children}</div>}
    </div>
  );
}
