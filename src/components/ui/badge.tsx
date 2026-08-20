import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        // Fill is `bg-muted`, NOT `bg-secondary`, plus a real border.
        //
        // In the light theme `--secondary` is oklch(0.91) against a
        // --background of oklch(0.94) - a 3% lightness step - so the fill was
        // invisible and every "draft"/"pending" status pill in the app read as
        // bare text. That is the same mis-specified token that made
        // <SkeletonText> disappear, and it gets the same remedy: `--muted`
        // (oklch 0.885) sits 0.055 below the page AND 0.09 below a card, so it
        // reads on both surfaces. In the dark themes --muted and --secondary
        // are the same lightness, so those are visually unchanged.
        //
        // Deliberately not <ActiveFilters>' `bg-card`, even though that chip is
        // the reference for "this looks like a pill": card-coloured fill works
        // on the page but vanishes on the many cards that host these badges
        // (organization card, product details, connect-payouts header, order
        // detail pages). The border carries the edge the way it does there.
        //
        // Costs no layout: the base already reserves `border border-transparent`.
        //
        // The link-only hover mixes toward --foreground for the same reason:
        // the previous `bg-muted/80` just made the fill MORE transparent, which
        // on the light theme lightens it - a hover that lowers contrast.
        secondary:
          "bg-muted text-secondary-foreground border-border/60 [a]:hover:bg-[color-mix(in_oklab,var(--muted)_94%,var(--foreground))]",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "span";

    return (
      <Comp
        ref={ref}
        data-slot="badge"
        data-variant={variant}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
