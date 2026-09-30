import { Heart } from "lucide-react";
import { useState } from "react";

import { formatPrice, type Product } from "@/data/site";
import { cn } from "@/lib/utils";

/** Reusable product card; all content comes from props so it can be fed by an API later. */
export function ProductCard({ product }: { product: Product }) {
  const [fav, setFav] = useState(false);
  const { name, category, price, compareAtPrice, installments, image, hoverImage, badge, colors } = product;
  const perInstallment = price / installments;

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img src={image} alt={`${name}, ${category}`} width={1395} height={1600} loading="lazy" decoding="async" className="catalog-photo absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02]" />
        <img src={hoverImage} alt="" aria-hidden="true" width={1395} height={1600} loading="lazy" decoding="async" className="catalog-photo absolute inset-0 size-full scale-[1.02] object-cover opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100" />
        {badge && (
          <span className={cn("absolute left-3 top-3 rounded-full px-3 py-1.5 text-[9px] font-medium tracking-[0.18em]", badge === "EDIÇÃO LIMITADA" ? "bg-wine text-card" : "bg-card text-foreground")}>
            {badge}
          </span>
        )}
        <button
          type="button"
          aria-label={fav ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
          aria-pressed={fav}
          onClick={() => setFav((v) => !v)}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-foreground transition-colors hover:text-magenta"
        >
          <Heart className={cn("size-[18px] transition-transform duration-300", fav && "animate-heart-pulse fill-wine text-wine")} strokeWidth={1.3} />
        </button>
        <a href="#sob-medida" className="absolute inset-x-3 bottom-3 flex h-11 translate-y-2 items-center justify-center rounded-full bg-background/95 text-[10px] uppercase tracking-[0.2em] opacity-0 transition-all duration-500 hover:text-magenta focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
          Ver detalhes
        </a>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">{category}</p>
          <h3 className="mt-1 truncate font-display text-xl">{name}</h3>
        </div>
        <div className="mt-1 flex shrink-0 gap-1" aria-label="Cores disponíveis">
          {colors.map((c) => (
            <span key={c} className="size-2.5 rounded-full border border-foreground/15" style={{ background: c }} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-[13px] tabular-nums">
        {compareAtPrice && <s className="mr-2 text-muted-foreground">{formatPrice(compareAtPrice)}</s>}
        <span className={cn(compareAtPrice && "text-magenta")}>{formatPrice(price)}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{installments}x de {formatPrice(perInstallment)} sem juros</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Feito à mão · 40h de produção</p>
      <a href="#sob-medida" className="link-line mt-3 text-[10px] uppercase tracking-[0.2em] md:hidden">Ver detalhes</a>
    </article>
  );
}
