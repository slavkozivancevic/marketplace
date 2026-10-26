import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonButton, SkeletonCopy } from "@/components/ui/skeleton";

/**
 * Placeholder for <ProductDetails>, built from the SAME Card / Badge /
 * Separator components so every box, gap and line height is the real one.
 * Labels, card titles, badges and buttons are the real copy drawn transparent;
 * only the product's own values are blank runs of the length a typical value
 * has.
 *
 * Which rows <ProductDetails> renders depends on the product (brand,
 * categories, compare-at price, specifications, SEO, variants...). This draws
 * the common shape: a published product with a slug, tags, a one-line
 * description, several images and no variants. Admin and dashboard share it;
 * `showActions` follows the page (the dashboard hides the status buttons from
 * members who cannot write, and its skeleton cannot know who is looking).
 */
export function ProductDetailsSkeleton({ showActions = true }: { showActions?: boolean }) {
  const t = useTranslations("products");
  const tf = useTranslations("productForm");

  return (
    <div aria-hidden className="space-y-6">
      {/* ── BASIC INFO ── */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            <SkeletonCopy>{t("basicInfo")}</SkeletonCopy>
          </CardTitle>
          {/* <ProductStatusActions> for a PUBLISHED product. */}
          {showActions && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SkeletonButton size="sm" label={t("unpublish")} />
              <SkeletonButton size="sm" label={t("archive")} />
              <SkeletonButton size="sm" label={t("deleteProduct")} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label={t("titleLabel")} chars={14} />
          <Row label={`${tf("slug")}:`} chars={14} mono />
          <div className="flex items-center gap-2 flex-wrap">
            <strong>
              <SkeletonCopy>{t("tagsLabel")}</SkeletonCopy>
            </strong>
            <SkeletonBadge variant="secondary" chars={16} />
            <SkeletonBadge variant="secondary" chars={10} />
          </div>
          <Row label={t("descLabel")} chars={26} />
          <div>
            <strong>
              <SkeletonCopy>{t("statusLabel")}</SkeletonCopy>
            </strong>{" "}
            <SkeletonBadge text={t("published")} />
          </div>
          <Row label={t("version")} chars={2} />
        </CardContent>
      </Card>

      <Separator />

      {/* ── MEDIA ── <ProductImageCarousel>: an h-96 slide, then the 64px
          thumbnail row it shows once there is more than one image. */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SkeletonCopy>{t("media")}</SkeletonCopy>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-96 w-full rounded-lg" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-16 shrink-0 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── PRICING & INVENTORY ── price, stock (no variants), taxes. */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SkeletonCopy>{tf("tabPricing")}</SkeletonCopy>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label={t("priceLabel")} chars={10} />
          <Row label={t("stockLabel")} chars={3} />
          <BadgeRow label={tf("chargeTaxes")} badge={tf("yes")} />
        </CardContent>
      </Card>

      <Separator />

      {/* ── SHIPPING ── a physical product that ships. */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SkeletonCopy>{tf("tabShipping")}</SkeletonCopy>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <BadgeRow label={tf("digitalProduct")} badge={tf("no")} />
          <BadgeRow label={tf("requiresShipping")} badge={tf("yes")} />
        </CardContent>
      </Card>

      <Separator />

      {/* ── VARIANTS ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <SkeletonCopy>{t("variants", { count: 0 })}</SkeletonCopy>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            <SkeletonCopy>{t("noVariants")}</SkeletonCopy>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** A blank run as wide as `chars` characters: an inline value of unknown text. */
function blank(chars: number) {
  return " ".repeat(chars * 2);
}

/** <ProductDetails>'s Row: a bold label, a space, the value. */
function Row({ label, chars, mono = false }: { label: string; chars: number; mono?: boolean }) {
  return (
    <div>
      <strong>
        <SkeletonCopy>{label}</SkeletonCopy>
      </strong>{" "}
      {mono ? (
        <code className="text-sm">
          <SkeletonCopy>{blank(chars)}</SkeletonCopy>
        </code>
      ) : (
        <SkeletonCopy>{blank(chars)}</SkeletonCopy>
      )}
    </div>
  );
}

/** A bold label followed by a yes/no <Badge>, as the real rows render it. */
function BadgeRow({ label, badge }: { label: string; badge: string }) {
  return (
    <div>
      <strong>
        <SkeletonCopy>{label}</SkeletonCopy>
      </strong>{" "}
      <SkeletonBadge text={badge} />
    </div>
  );
}

/** A real <Badge> box (same height, padding and baseline) filled as a placeholder. */
function SkeletonBadge({
  text,
  chars = 0,
  variant = "default",
}: {
  text?: string;
  chars?: number;
  variant?: "default" | "secondary";
}) {
  return (
    <Badge variant={variant} className="animate-pulse bg-muted text-transparent">
      {text ?? blank(chars)}
    </Badge>
  );
}
