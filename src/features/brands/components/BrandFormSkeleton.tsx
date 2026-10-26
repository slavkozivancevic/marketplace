"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { readRouteShape } from "@/lib/navigation/routeShape";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonCopy,
  SkeletonFormDescription,
  SkeletonLocaleSections,
  skeletonLocaleTextareas,
} from "@/components/ui/skeleton";

/** What the brands list hands an edit's skeleton: each locale's description. */
export type BrandFormShape = { descriptions: Record<string, string | null> };

export function brandShapeKey(brandId: string): string {
  return `brand:${brandId}`;
}

/**
 * Placeholder for <BrandForm>, shared by the create and edit loading states -
 * the two render the same fields and differ only in the footer, which is why
 * `mode` is passed through rather than each page owning a copy.
 *
 * Per-locale box: brand name, slug (input + description / availability row),
 * description (Textarea rows={3}, so the shared `min-h-16` floor). Then the
 * logo section, whose caption row carries a light/dark preview pair, over four
 * fields that EACH carry a description: logo URL, backdrop, dark logo URL, dark
 * backdrop. The descriptions are the real copy, so they wrap like the form's.
 */
export function BrandFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("brands");
  const params = useParams<{ id?: string }>();
  // Each description <Textarea> is as tall as its text, so an edit draws the
  // brand's own texts when the list handed them over (see AdminBrandsPage).
  const shape = mode === "edit" && params.id ? readRouteShape<BrandFormShape>(brandShapeKey(params.id)) : null;

  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "slug", "textarea"]}
        labelWidths={["w-20", "w-12", "w-24"]}
        mode={mode}
        textareas={shape ? skeletonLocaleTextareas(shape.descriptions, t("descPlaceholder"), 3) : undefined}
      />

      {/* Logo & backdrop */}
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest">
            <SkeletonCopy>{t("logoSection")}</SkeletonCopy>
          </p>
          {/* LogoThemePreview x2: a 44px tile over its `text-[10px]` label
              (a 15px line), `gap-1` between - 63px in all. */}
          <div className="flex items-start gap-3">
            {[t("logoPreviewLight"), t("logoPreviewDark")].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Skeleton className="size-11 rounded-sm" />
                <span className="text-[10px]">
                  <SkeletonCopy>{label}</SkeletonCopy>
                </span>
              </div>
            ))}
          </div>
        </div>
        <LogoField label={t("logoUrl")} description={t("logoDesc")} />
        <LogoField label={t("logoBackdrop")} description={t("logoBackdropDesc")} />
        <LogoField label={t("logoUrlDark")} description={t("logoUrlDarkDesc")} />
        <LogoField label={t("logoBackdropForDark")} description={t("logoBackdropForDarkDesc")} />
      </div>
    </SkeletonAdminForm>
  );
}

/** A <FormItem>: label, an h-8 input or select, its description. */
function LogoField({ label, description }: { label: string; description: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm leading-none font-medium">
        <SkeletonCopy>{label}</SkeletonCopy>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
      <SkeletonFormDescription>{description}</SkeletonFormDescription>
    </div>
  );
}
