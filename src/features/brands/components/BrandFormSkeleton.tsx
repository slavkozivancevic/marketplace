import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonFormRow,
  SkeletonLocaleSections,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <BrandForm>, shared by the create and edit loading states -
 * the two render the same fields and differ only in the footer, which is why
 * `mode` is passed through rather than each page owning a copy.
 *
 * Per-locale box: brand name, slug (input + regenerate button + description /
 * availability row), description (Textarea rows={3}, so the shared `min-h-16`
 * floor). Then the logo section, whose caption row carries a light/dark preview
 * pair, over logo URL, backdrop, dark logo URL and dark backdrop.
 */
export function BrandFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  return (
    <SkeletonAdminForm mode={mode}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "slug", "textarea"]}
        labelWidths={["w-20", "w-12", "w-24"]}
      />

      {/* Logo & backdrop */}
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-16" />
          </div>
          {/* LogoThemePreview x2 - a tile with its label underneath. */}
          <div className="flex items-start gap-3">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <Skeleton className="h-2.5 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonFormRow kind="input-hint" labelWidth="w-16" />
        <SkeletonFormRow labelWidth="w-24" />
        <SkeletonFormRow kind="input-hint" labelWidth="w-20" />
        <SkeletonFormRow labelWidth="w-28" />
      </div>
    </SkeletonAdminForm>
  );
}
