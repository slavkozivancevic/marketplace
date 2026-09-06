import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonFormRow,
  SkeletonLocaleSections,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <CategoryForm>, shared by the create and edit loading states.
 *
 * Per-locale box: name, slug (input + regenerate button + description /
 * availability row), description (Textarea rows={2}). Then the untranslated
 * settings - parent select, image URL, order - the two switch cards (active,
 * featured) and the attribute-filters section.
 */
export function CategoryFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  return (
    <SkeletonAdminForm mode={mode}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "slug", "textarea"]}
        labelWidths={["w-16", "w-12", "w-24"]}
      />

      <SkeletonFormRow kind="input-hint" labelWidth="w-16" />
      <SkeletonFormRow kind="input-hint" labelWidth="w-20" />
      <SkeletonFormRow kind="input-hint" labelWidth="w-12" />

      {/* Active + featured. Each is a <FormItem> (space-y-2) with the border and
          padding on the outside and the label/switch row nested inside. */}
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              {/* FormLabel is `text-base`, FormDescription `text-[0.8rem]`. */}
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1 h-3 w-56" />
            </div>
            <Skeleton className="h-[18.4px] w-8 rounded-full" />
          </div>
        </div>
      ))}

      {/* <CategoryAttributesField>: a heading and hint, the inherited-attribute
          badges, then one dashed row per assigned attribute. */}
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        <div>
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-0.5 h-3 w-64" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="rounded-lg border border-dashed border-border/60 p-2.5 space-y-1.5"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-[18.4px] w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonAdminForm>
  );
}
