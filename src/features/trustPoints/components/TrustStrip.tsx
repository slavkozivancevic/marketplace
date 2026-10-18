import { getLocale } from "next-intl/server";
import { cacheLife, cacheTag } from "next/cache";
import { cn } from "@/lib/utils";
import { CacheTags } from "@/lib/cache/tags";
import { getActiveTrustPoints } from "../db/trustPoints";
import { getTrustPointLabel, getTrustPointSublabel } from "../utils/translations";
import { TRUST_POINT_FALLBACK_ICON, TRUST_POINT_ICONS } from "../icons";
import { trustStripColumns } from "../utils/stripColumns";

/**
 * The platform's own promises, in a row.
 *
 * A server component with no client code: the strip is static text an admin
 * edits, so there is nothing to hydrate. The read is cached under its own tag
 * and the admin actions call `updateTag`, so a change is visible on the next
 * navigation rather than after a hard reload.
 *
 * Renders NOTHING when no point is active. An empty strip is worse than no
 * strip - it leaves a bordered band of whitespace across the page.
 *
 * The column count follows how many promises there are (see
 * `trustStripColumns`) rather than being pinned at four: the admin decides how
 * many exist, and a hard four left five entries as "four across, one stranded
 * below". Tailwind needs the finished class name, hence the lookup rather than
 * an interpolated string.
 */
export async function TrustStrip({ className }: { className?: string }) {
  const points = await fetchActiveTrustPoints();
  if (points.length === 0) return null;

  const locale = await getLocale();
  const columns = COLUMN_CLASS[trustStripColumns(points.length)];

  return (
    <section
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-3",
        columns,
        className,
      )}
    >
      {points.map((point) => {
        const Icon = TRUST_POINT_ICONS[point.icon] ?? TRUST_POINT_FALLBACK_ICON;
        const label = getTrustPointLabel(point, locale);
        const sublabel = getTrustPointSublabel(point, locale);
        // A point with no label in any locale is a half-saved row; drawing a
        // lone icon for it would say nothing.
        if (!label) return null;
        return (
          <div key={point.id} className="flex items-start gap-2.5 min-w-0">
            <Icon className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{label}</p>
              {sublabel && (
                <p className="text-xs text-muted-foreground leading-snug">{sublabel}</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Written out in full because Tailwind scans for literal class names - a
 *  template string would compile to nothing. */
const COLUMN_CLASS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
} as const;

async function fetchActiveTrustPoints() {
  "use cache";
  cacheTag(CacheTags.trustPoints.all());
  cacheLife("max");
  return getActiveTrustPoints();
}
