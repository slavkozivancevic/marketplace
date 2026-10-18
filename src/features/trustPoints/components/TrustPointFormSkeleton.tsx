import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonFormRow,
  SkeletonLocaleSections,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <TrustPointForm>, shared by the create and edit loading
 * states - they render the same fields and differ only in the footer.
 *
 * Four locale boxes (label + sublabel, no slug row - a trust point has no URL),
 * then the presentation box: an icon <Select> and an order <Input> (both `h-8
 * rounded-lg`, the real control tokens), and the active switch, which is a
 * bordered `p-4` row with two lines of text on the left and a 32x18 switch on
 * the right rather than a full-width field.
 */
export function TrustPointFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  return (
    <SkeletonAdminForm mode={mode}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "input"]}
        labelWidths={["w-12", "w-20"]}
      />

      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        {/* Section caption: `text-xs font-semibold uppercase tracking-widest`. */}
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-24" />
        </div>
        <SkeletonFormRow labelWidth="w-10" />
        {/* Order carries a FormDescription under the input. */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-3 w-48" />
        </div>
        {/* The switch row: its own border and padding, so it has to be drawn
            rather than folded into a plain field row. */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          {/* `space-y-0.5`, matching the real row - `space-y-1.5` here made the
              block 4px taller than the form it stands in for. */}
          <div className="space-y-0.5 pr-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-56" />
          </div>
          {/* <Switch> at its default size is exactly 18.4 x 32. */}
          <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
        </div>
      </div>
    </SkeletonAdminForm>
  );
}
