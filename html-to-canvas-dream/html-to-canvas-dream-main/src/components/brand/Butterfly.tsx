import { cn } from "@/lib/utils";

type Beat = "loop" | "hover" | "once" | "none";

/**
 * Vector BK logo traced from the official supplied artwork.
 * Each symbol remains an independent vector group so both sides can flap.
 */
export function Butterfly({ className, title }: { className?: string; beat?: Beat; title?: string }) {
  return (
    <svg
      viewBox="0 0 1343 1171"
      className={cn("butterfly block overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="bk-left" x1="120" y1="170" x2="690" y2="960" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B94D60" />
          <stop offset="0.42" stopColor="#FFB6C3" />
          <stop offset="0.68" stopColor="#F397A8" />
          <stop offset="1" stopColor="#B94859" />
        </linearGradient>
        <linearGradient id="bk-right" x1="1115" y1="175" x2="800" y2="970" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B94D60" />
          <stop offset="0.46" stopColor="#FFA9B8" />
          <stop offset="1" stopColor="#BA4D5E" />
        </linearGradient>
      </defs>
      <g className="wing-l bk-wing-l">
        <path d="M135 196H430C575 196 663 270 663 378C663 490 588 556 455 556H193" fill="none" stroke="url(#bk-left)" strokeWidth="104" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M193 556H452C602 556 682 632 682 768C682 905 601 959 218 959" fill="none" stroke="url(#bk-left)" strokeWidth="104" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="wing-r bk-wing-r">
        <path d="M1130 197L787 557L1131 957" fill="none" stroke="url(#bk-right)" strokeWidth="104" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Kept for API compatibility; wings now flap continuously. */
export function beatOnce(_el: Element | null) {}
