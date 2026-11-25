import { BreadcrumbNav, type BreadcrumbItem } from "./BreadcrumbNav";
import { absoluteUrl, breadcrumbJsonLd, renderJsonLd } from "@/lib/seo/jsonLd";

export type { BreadcrumbItem };

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
      <BreadcrumbNav items={items} className={className} />
    </>
  );
}
