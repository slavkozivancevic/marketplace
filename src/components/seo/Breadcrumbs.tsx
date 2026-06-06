import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { absoluteUrl, breadcrumbJsonLd, renderJsonLd } from "@/lib/seo/jsonLd";

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
 * Accessible breadcrumb trail rendered above the page header. Two
 * responsibilities tied together:
 *   - **UX:** lets the visitor navigate up the hierarchy with
 *     client-side soft navigation.
 *   - **SEO:** crawlers without JS read the visible trail when JSON-LD
 *     parsers are unavailable; we also inline a `BreadcrumbList`
 *     `application/ld+json` payload using absolute URLs (which is what
 *     schema.org requires) so the visible nav can stay relative.
 *
 * The last item (current page) is rendered as plain text, not a link -
 * Schema.org / aria pattern. Earlier items use `next/link` with a
 * relative path so navigation stays on the visitor's current origin.
 */
export function Breadcrumbs({
  items,
  className,
  seo = true,
}: {
  items: BreadcrumbItem[];
  className?: string;
  /** Set false on pages behind auth where crawlers won't reach. */
  seo?: boolean;
}) {
  if (items.length === 0) return null;

  const schema = seo
    ? breadcrumbJsonLd(
        items.map((item) => ({
          name: item.name,
          url: absoluteUrl(item.href),
        })),
      )
    : null;

  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: renderJsonLd(schema) }}
        />
      )}
      <nav
        aria-label="Breadcrumb"
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground py-2",
          className,
        )}
      >
        <ol className="flex items-center gap-1 flex-wrap">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li
                key={`${index}-${item.href}`}
                className="flex items-center gap-1"
              >
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                )}
                {isLast ? (
                  <span
                    className="font-medium text-foreground truncate max-w-[20rem]"
                    aria-current="page"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors truncate max-w-[16rem]"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
