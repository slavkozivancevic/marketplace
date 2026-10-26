"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonButton,
  SkeletonCopy,
  SkeletonFormDescription,
  SkeletonFormRow,
} from "@/components/ui/skeleton";
import { readRouteShape } from "@/lib/navigation/routeShape";
import { OPTION_TYPES, type AttributeTypeValue } from "../schema/attributes";

/** What the attributes list hands an edit's skeleton (see AdminAttributesPage). */
export type AttributeFormShape = { type: AttributeTypeValue; optionCount: number };

export function attributeShapeKey(attributeId: string): string {
  return `attribute:${attributeId}`;
}

/**
 * Placeholder for <AttributeForm>, shared by the create and edit loading states.
 *
 * Attributes are laid out differently from the other translatable forms. There
 * is one bordered box holding the default-locale label, the key (input, then
 * description / availability) and - INSIDE the same box - <LocaleLabelInputs>,
 * the `sm:grid-cols-3` row of compact h-8 inputs for sr/de/es. Then the type
 * select (with the unit field beside it for RANGE), the options editor for
 * option types, and the order stepper (`w-32`).
 *
 * A create opens as SELECT with no options: the editor's dashed empty state.
 * An edit draws the attribute's own type and option count when the list
 * handed them over; one opened by URL falls back to SELECT with three options.
 * Known copy is the real text.
 */
export function AttributeFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("adminAttributes");
  const params = useParams<{ id?: string }>();
  const shape: AttributeFormShape =
    (mode === "edit" && params.id ? readRouteShape<AttributeFormShape>(attributeShapeKey(params.id)) : null) ??
    (mode === "edit" ? { type: "SELECT", optionCount: 3 } : { type: "SELECT", optionCount: 0 });
  const showOptions = OPTION_TYPES.includes(shape.type);

  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        {/* Locale caption: `text-xs font-semibold uppercase tracking-widest`. */}
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <SkeletonFormDescription>{t("labelDesc")}</SkeletonFormDescription>
        </div>
        <SkeletonFormRow kind="key" labelWidth="w-10" mode={mode} />
        <LocaleLabelInputsSkeleton />
      </div>

      {/* Type + unit: a `flex flex-wrap gap-4` row - the type <FormItem> is
          `flex-1 min-w-48`, the RANGE-only unit field `w-40` beside it. */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-48 space-y-2">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <SkeletonFormDescription>{t(`typeDesc_${shape.type}`)}</SkeletonFormDescription>
        </div>
        {shape.type === "RANGE" && (
          <div className="w-40 space-y-2">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <SkeletonFormDescription>{t("unitDesc")}</SkeletonFormDescription>
          </div>
        )}
      </div>

      {showOptions && (
        // Options editor: the required label opposite an "Add option" button.
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-16" />
            <SkeletonButton size="sm" label={t("addOption")} withIcon />
          </div>

          {shape.optionCount === 0 ? (
            // Empty state: one `text-sm` line inside a dashed p-4 box.
            <p className="rounded-lg border border-dashed p-4 text-center text-sm">
              <SkeletonCopy>{t("noOptions")}</SkeletonCopy>
            </p>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: shape.optionCount }, (_, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 space-y-3">
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
      )}

      {/* Order: a `w-32` NumberStepper plus its description. */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <SkeletonFormDescription>{t("orderDesc")}</SkeletonFormDescription>
      </div>
    </SkeletonAdminForm>
  );
}

/**
 * <LocaleLabelInputs>: one compact column per non-default locale, each a
 * `text-xs font-normal` <FormLabel> over an input pinned to `h-8`. The label's
 * `leading-none` is merged away by `text-xs`, so its line is 16px, not 12px.
 */
function LocaleLabelInputsSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
