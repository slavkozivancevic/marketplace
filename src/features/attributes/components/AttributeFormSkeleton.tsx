import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonFormRow,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <AttributeForm>, shared by the create and edit loading states.
 *
 * Attributes are laid out differently from the other translatable forms. There
 * is one bordered box holding the default-locale label, the key (an input with
 * a regenerate button) and - INSIDE the same box - <LocaleLabelInputs>, the
 * `sm:grid-cols-3` row of compact h-8 inputs for sr/de/es. Then the type select,
 * the options editor and the order stepper.
 *
 * The form defaults to type SELECT, so the options editor is open and the unit
 * field (RANGE only) is not rendered. A create form has no options yet, so its
 * editor shows the dashed empty state; an edit form shows option rows.
 */
export function AttributeFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  return (
    <SkeletonAdminForm mode={mode}>
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        {/* Locale caption: `text-xs font-semibold uppercase tracking-widest`. */}
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-24" />
        </div>
        <SkeletonFormRow kind="input-hint" labelWidth="w-14" />
        <SkeletonFormRow kind="key" labelWidth="w-10" />
        <LocaleLabelInputsSkeleton />
      </div>

      {/* Type (Select) with its per-type description line. */}
      <SkeletonFormRow kind="input-hint" labelWidth="w-10" />

      {/* Options editor: the required label opposite an "Add option" button. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-16" />
          {/* variant="outline" size="sm" -> h-7. */}
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {mode === "create" ? (
          // Empty state: one `text-sm` line inside a dashed p-4 box.
          <div className="rounded-lg border border-dashed p-4">
            <Skeleton className="h-3.5 w-56 mx-auto" />
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 p-3 space-y-3"
              >
                <div className="flex items-start gap-2">
                  {/* GripVertical, h-4 w-4 with mt-2.5. */}
                  <Skeleton className="mt-2.5 h-4 w-4 shrink-0 rounded" />
                  {/* This input overrides the shared height to h-9. */}
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                  {/* Remove: variant="ghost" size="icon" -> size-8. */}
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                </div>
                <div className="pl-6">
                  <LocaleLabelInputsSkeleton />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order: a NumberStepper plus its description. */}
      <SkeletonFormRow kind="input-hint" labelWidth="w-12" />
    </SkeletonAdminForm>
  );
}

/**
 * <LocaleLabelInputs>: one compact column per non-default locale, each a
 * `text-xs font-normal` label over an input pinned to `h-8`.
 */
function LocaleLabelInputsSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
