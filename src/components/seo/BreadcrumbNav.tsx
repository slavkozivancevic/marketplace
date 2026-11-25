import Link from "next/link";
import { LinkPendingMark } from "@/components/ui/pressable";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  name: string;
  /**
   * Relative, locale-prefixed path (e.g. `/sr/brendovi/foo`). Pages
   * compute these via `getPathname({ href, locale })` from
   * `@/i18n/navigation`, so they're already locale-correct.
   *
   * Must be a path, not an absolute URL: using an absolute URL would
   * make `next/link` do a hard cross-origin navigation, which on local
   * dev (where APP_URL is the ngrok tunnel) would bounce the user from
   * localhost to the tunnel and break the back-button trail.
   */
  href: string;
};

/**
 * The visible trail of <Breadcrumbs>, without its JSON-LD. Split out because
 * the JSON-LD half needs the server env (absolute URLs), and a client skeleton
 * that knows the real crumbs - a detail route reads its id from the URL - draws
 * this very markup, so the trail cannot wrap differently while it loads.
 *
 * The last item (current page) is rendered as plain text, not a link -
 * Schema.org / aria pattern. Earlier items use `next/link` with a
 * relative path so navigation stays on the visitor's current origin.
 */
export function BreadcrumbNav({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-xs text-muted-foreground pt-2 pb-1", className)}
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${index}-${item.href}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
              {isLast ? (
                <span className="font-medium text-foreground truncate max-w-[20rem]" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground active:text-foreground active:duration-0 has-data-link-pending:text-foreground transition-colors truncate max-w-[16rem]"
                >
                  {item.name}
                  <LinkPendingMark />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
