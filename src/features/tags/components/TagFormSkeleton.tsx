import { useTranslations } from "next-intl";
import { SkeletonAdminForm, SkeletonLocaleSections } from "@/components/ui/skeleton";

/**
 * Placeholder for <TagForm>, shared by the create and edit loading states -
 * they render the same fields and differ only in the footer.
 *
 * The simplest of the translatable forms: one bordered box per locale holding
 * a name and a slug (the input, then the description / availability row
 * underneath).
 */
export function TagFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("tags");
  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "slug"]}
        labelWidths={["w-16", "w-12"]}
        mode={mode}
      />
    </SkeletonAdminForm>
  );
}
