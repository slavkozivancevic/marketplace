import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonFormRow,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <CouponForm>, shared by the create and edit loading states.
 *
 * Coupons are the one admin form with no translatable sections: a flat stack at
 * `max-w-lg space-y-5`. Its fields use a raw <Label> + control rather than
 * <FormItem>, so the rows are `space-y-1.5`, not `space-y-2`.
 *
 * Layout: code on its own; a two-column grid for type + value; a second
 * two-column grid holding THREE fields (min order, usage limit, per-user limit)
 * so the third wraps onto a second row; the expiry picker; the active card.
 */
export function CouponFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  return (
    <SkeletonAdminForm maxWidth="max-w-lg" spacing="space-y-5" mode={mode}>
      <SkeletonFormRow labelWidth="w-12" spacing="space-y-1.5" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SkeletonFormRow labelWidth="w-10" spacing="space-y-1.5" />
        <SkeletonFormRow labelWidth="w-20" spacing="space-y-1.5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <SkeletonFormRow labelWidth="w-20" spacing="space-y-1.5" />
        <SkeletonFormRow labelWidth="w-24" spacing="space-y-1.5" />
        <SkeletonFormRow labelWidth="w-24" spacing="space-y-1.5" />
      </div>

      {/* Expiry: a DatePicker capped at `max-w-xs`. */}
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-8 w-full max-w-xs rounded-lg" />
      </div>

      {/* Active card. */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            {/* Label is `text-base`; the hint under it is `text-sm`. */}
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          {/* <Switch> is h-[18.4px] w-8. */}
          <Skeleton className="h-[18.4px] w-8 rounded-full" />
        </div>
      </div>
    </SkeletonAdminForm>
  );
}
