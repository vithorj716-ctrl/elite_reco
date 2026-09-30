import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group inline-flex shrink-0 items-center justify-center gap-2 font-sans text-[10.5px] uppercase tracking-[0.22em] transition-[background-color,color,border-color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outlineHero:
          "h-12 rounded-full border border-hero-foreground/50 bg-transparent px-8 text-hero-foreground hover:border-hero-foreground hover:bg-hero-foreground hover:text-hero",
        icon: "size-11 rounded-none text-foreground opacity-80 hover:opacity-100 hover:text-magenta",
        signature:
          "relative h-12 overflow-hidden rounded-full bg-primary px-8 text-primary-foreground hover:bg-wine [&>*]:relative",
        line: "h-12 rounded-full border border-border px-8 text-foreground hover:border-magenta hover:text-magenta",
        solid: "h-11 rounded-none bg-primary px-6 text-primary-foreground hover:bg-primary/90",
        ghost: "h-10 rounded-none px-4 text-foreground hover:bg-muted",
        link: "h-auto p-0 text-foreground underline-offset-4 hover:underline",
        default: "h-11 rounded-none bg-primary px-6 text-primary-foreground hover:bg-primary/90",
        outline:
          "h-11 rounded-none border border-border bg-background px-6 text-foreground hover:bg-muted",
      },
      size: {
        default: "",
        icon: "size-10 p-0",
        sm: "h-9 px-4",
        lg: "h-12 px-8",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "default",
    },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;
export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariants["variant"] | undefined;
  size?: ButtonVariants["size"] | undefined;
  asChild?: boolean | undefined;
};

function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };