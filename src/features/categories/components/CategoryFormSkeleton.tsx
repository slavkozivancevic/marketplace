"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonCopy,
  SkeletonFormDescription,
  SkeletonLocaleSections,
  SkeletonSelectTail,
  skeletonLocaleTextareas,
} from "@/components/ui/skeleton";
import { readRouteShape } from "@/lib/navigation/routeShape";

/**
 * What the categories list hands an edit's skeleton (see AdminCategoriesPage):
 * everything that sizes the form - each locale's description, whether it is a
 * department (only those get the featured card), and its attribute filters.
 */
export type CategoryFormShape = {
  descriptions: Record<string, string | null>;
  isRoot: boolean;
  /** Labels of the attributes inherited from its ancestors, in the form's order. */
  inherited: string[];
  /** Its own assignments: the attribute's label and type. */
  own: { label: string; type: string }[];
  /** Whether any attribute is left to add - the "add" picker, else nothing or a note. */
  picker: boolean;
};

export function categoryShapeKey(categoryId: string): string {
  return `category:${categoryId}`;
}

/** A new category: at the root, nothing inherited or assigned, the picker open. */
const CREATE_SHAPE: Omit<CategoryFormShape, "descriptions"> = { isRoot: true, inherited: [], own: [], picker: true };

/**
 * Placeholder for <CategoryForm>, shared by the create and edit loading states.
 *
 * Per-locale box: name, slug (input + description / availability row),
 * description (Textarea rows={2}). Then the untranslated settings - parent
 * select, image URL, order stepper (`w-32`), each with its description - the
 * switch cards (active; featured for a department only) and the
 * attribute-filters section: inherited chips, own rows, the "add" picker.
 *
 * An edit draws the category's own texts and filters when the list handed
 * them over; one opened by URL falls back to a new category's shape. Known
 * copy is the real text.
 */
export function CategoryFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("adminCategories");
  const tAttr = useTranslations("adminAttributes");
  const params = useParams<{ id?: string }>();
  const handed = mode === "edit" && params.id ? readRouteShape<CategoryFormShape>(categoryShapeKey(params.id)) : null;
  const shape = handed ?? CREATE_SHAPE;

  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "slug", "textarea"]}
        labelWidths={["w-16", "w-12", "w-24"]}
        mode={mode}
        textareas={handed ? skeletonLocaleTextareas(handed.descriptions, t("descPlaceholder"), 2) : undefined}
      />

      <SettingField label={t("parent")} description={t("parentDesc")} />
      <SettingField label={t("imageUrl")} description={t("imageUrlDesc")} />
      <SettingField label={t("order")} description={t("orderDesc")} controlClassName="w-32" />

      <SwitchCard label={t("isActive")} description={t("isActiveDesc")} />
      {shape.isRoot && <SwitchCard label={t("isFeatured")} description={t("isFeaturedDesc")} />}

      {/* <CategoryAttributesField> */}
      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">
            <SkeletonCopy>{t("attributesTitle")}</SkeletonCopy>
          </p>
          <p className="text-xs mt-0.5">
            <SkeletonCopy>{t("attributesDesc")}</SkeletonCopy>
          </p>
        </div>

        {shape.inherited.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium">
              <SkeletonCopy>{t("inheritedAttributes")}</SkeletonCopy>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shape.inherited.map((label) => (
                // A secondary <Badge>: a 12px lock icon, then the label.
                <Badge
                  key={label}
                  variant="secondary"
                  className="gap-1 font-normal animate-pulse bg-muted text-transparent"
                >
                  <span className="size-3" />
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {shape.own.length > 0 && (
          <div className="space-y-2">
            {shape.own.map((row) => (
              <div key={row.label} className="rounded-lg border border-border/60 p-2.5 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                    <span className="min-w-0 truncate sm:flex-1 text-sm font-medium">
                      <SkeletonCopy>{row.label}</SkeletonCopy>
                    </span>
                    <Badge
                      variant="outline"
                      className="max-w-[min(8rem,100%)] min-w-0 shrink-0 text-[10px] font-normal animate-pulse border-transparent bg-muted text-transparent"
                    >
                      <span className="min-w-0 truncate">{tAttr(`type_${row.type}`)}</span>
                    </Badge>
                  </div>
                  {/* Order stepper. */}
                  <Skeleton className="h-8 w-16 shrink-0 rounded-lg" />
                  {/* Filterable toggle: the switch and its `text-xs` label. */}
                  <span className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-xs shrink-0">
                    <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
                    <SkeletonCopy>{t("filterable")}</SkeletonCopy>
                  </span>
                  {/* Remove: an icon button, size-8. */}
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {shape.picker ? (
          <>
            {/* The "add attribute filter" <Select>, last in a `space-y-4` box. */}
            <Skeleton className="h-8 w-full rounded-lg" />
            <SkeletonSelectTail />
          </>
        ) : (
          shape.own.length === 0 &&
          shape.inherited.length === 0 && (
            <p className="text-sm rounded-lg border border-dashed p-3 text-center">
              <SkeletonCopy>{t("noAttributesAvailable")}</SkeletonCopy>
            </p>
          )
        )}
      </div>
    </SkeletonAdminForm>
  );
}

/** A <FormItem>: label, an h-8 control, its description. */
function SettingField({
  label,
  description,
  controlClassName = "w-full",
}: {
  label: string;
  description: string;
  controlClassName?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm leading-none font-medium">
        <SkeletonCopy>{label}</SkeletonCopy>
      </div>
      <Skeleton className={cn("h-8 rounded-lg", controlClassName)} />
      <SkeletonFormDescription>{description}</SkeletonFormDescription>
    </div>
  );
}

/**
 * A switch <FormItem> with the border on the outside: a `text-base` label (the
 * label's `leading-none` is merged away, so a 24px line) over a 19.2px-a-line
 * description, the switch on the right.
 */
function SwitchCard({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-medium">
            <SkeletonCopy>{label}</SkeletonCopy>
          </div>
          <SkeletonFormDescription>{description}</SkeletonFormDescription>
        </div>
        <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
      </div>
    </div>
  );
}
