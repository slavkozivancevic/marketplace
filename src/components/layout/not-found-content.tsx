import type { ComponentProps, ReactNode } from "react";
import { Home, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type NotFoundContentProps = {
  /** Uppercase eyebrow label above the heading (e.g. "404 - Not Found"). */
  eyebrow: string;
  /** Main heading. */
  heading: string;
  /** Supporting description line. */
  description: string;
  /** Target of the primary action button. */
  backHref: ComponentProps<typeof Link>["href"];
  /** Label of the primary action button. */
  backLabel: string;
  /** Optional badge icon override (defaults to a search glyph). */
  icon?: ReactNode;
};

/**
 * Shared centered 404 content (icon badge, eyebrow, heading, description,
 * primary action) used across every styled `not-found.tsx`. Callers supply
 * the surrounding layout chrome; this only renders the inner block so the
 * look stays identical everywhere.
 */
export function NotFoundContent({
  eyebrow,
  heading,
  description,
  backHref,
  backLabel,
  icon,
}: NotFoundContentProps) {
  return (
    <div className="max-w-md w-full text-center space-y-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        {icon ?? <Search className="h-9 w-9 text-muted-foreground" />}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {heading}
        </h1>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button asChild>
          <Link href={backHref}>
            <Home className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}