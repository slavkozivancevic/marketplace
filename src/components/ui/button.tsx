import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Every variant carries the full interaction ladder: rest -> hover
        // (lighter) -> active/pressed (darker than hover) -> disabled (the
        // shared opacity-50 in the base). The old default variant only
        // restyled hover when rendered as an <a> (`[a]:hover:...`), so plain
        // primary <button>s had no hover feedback at all - the source of the
        // hover inconsistency across the app. `hover:` is chained behind
        // `pointer-fine:` everywhere below - plain `:hover` can get stuck
        // "on" on touch (press, drag off, release outside never fires a real
        // mouseleave to clear it), leaving the button visibly stuck in its
        // hover color; pointer-fine gates it to devices with real hover.
        default: "bg-primary text-primary-foreground pointer-fine:hover:bg-primary/85 active:bg-primary/75",
        // The aria-expanded "held open" styling is scoped to MENU triggers
        // (aria-haspopup=menu, i.e. DropdownMenu). Radix sets aria-expanded on
        // dialog/popover triggers too - an un-scoped variant restyled e.g. a
        // ghost delete icon-button into a muted rectangle (and overrode its
        // text-destructive color) the whole time its confirm dialog was open.
        outline:
          "border-border bg-background pointer-fine:hover:bg-muted pointer-fine:hover:text-foreground active:bg-muted/70 aria-expanded:aria-[haspopup=menu]:bg-muted aria-expanded:aria-[haspopup=menu]:text-foreground dark:border-input dark:bg-input/30 dark:pointer-fine:hover:bg-input/50 dark:active:bg-input/70",
        secondary:
          "bg-secondary text-secondary-foreground pointer-fine:hover:bg-secondary/80 active:bg-secondary/70 aria-expanded:aria-[haspopup=menu]:bg-secondary aria-expanded:aria-[haspopup=menu]:text-secondary-foreground",
        ghost:
          "pointer-fine:hover:bg-muted pointer-fine:hover:text-foreground active:bg-muted/70 aria-expanded:aria-[haspopup=menu]:bg-muted aria-expanded:aria-[haspopup=menu]:text-foreground dark:pointer-fine:hover:bg-muted/50 dark:active:bg-muted/70",
        destructive:
          "bg-destructive/10 text-destructive pointer-fine:hover:bg-destructive/20 active:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:pointer-fine:hover:bg-destructive/30 dark:active:bg-destructive/40 dark:focus-visible:ring-destructive/40",
        // High-emphasis (filled) destructive - the canonical style for the
        // confirm action of a delete dialog. `destructive` (above) stays the
        // subtle style for inline / trigger buttons. Both use theme tokens so
        // they track every selected theme.
        //
        // Hover/active darken the red itself (color-mix toward black) instead
        // of thinning it with `/90` `/80`. An alpha ramp composites against
        // whatever sits BEHIND the button, so the same classes read as a clear
        // darkening on a dark popover but as an almost invisible wash on the
        // light theme's near-white one. Mixing keeps the step identical in
        // every theme and on every surface.
        destructiveSolid:
          "bg-destructive text-destructive-foreground pointer-fine:hover:bg-[color-mix(in_oklab,var(--destructive)_90%,black)] active:bg-[color-mix(in_oklab,var(--destructive)_80%,black)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 pointer-fine:hover:underline active:text-primary/80",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export { Button, buttonVariants, type ButtonProps };
