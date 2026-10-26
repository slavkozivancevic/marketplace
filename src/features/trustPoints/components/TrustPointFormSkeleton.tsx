import { useTranslations } from "next-intl";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonCopy,
  SkeletonFormDescription,
  SkeletonFormRow,
  SkeletonLocaleSections,
} from "@/components/ui/skeleton";

/**
 * Placeholder for <TrustPointForm>, shared by the create and edit loading
 * states - they render the same fields and differ only in the footer.
 *
 * Four locale boxes (label + sublabel, no slug row - a trust point has no URL),
 * then the presentation box: an icon <Select>, the order <Input> with its
 * description, and the active switch row. The descriptions and the switch
 * row's label are the real copy, so they wrap where the loaded form does.
 */
export function TrustPointFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("trustPoints");

  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <SkeletonLocaleSections
        radius="lg"
        fields={["input", "input"]}
        labelWidths={["w-12", "w-20"]}
        mode={mode}
      />

      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        {/* Section caption: `text-xs font-semibold uppercase tracking-widest`. */}
        <p className="text-xs font-semibold uppercase tracking-widest">
          <SkeletonCopy>{t("presentation")}</SkeletonCopy>
        </p>
        <SkeletonFormRow labelWidth="w-10" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <SkeletonFormDescription>{t("orderDesc")}</SkeletonFormDescription>
        </div>
        {/* The switch row is a <FormItem>, so its `space-y-2` survives the
            flex classes: Tailwind 4 puts an 8px bottom margin on the text
            block, which makes the row 8px taller. Kept here for the same box. */}
        <div className="flex items-center justify-between rounded-lg border p-4 space-y-2">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm leading-none font-medium">
              <SkeletonCopy>{t("activeLabel")}</SkeletonCopy>
            </div>
            <SkeletonFormDescription>{t("activeDesc")}</SkeletonFormDescription>
          </div>
          {/* <Switch> at its default size is exactly 18.4 x 32. */}
          <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
        </div>
      </div>
    </SkeletonAdminForm>
  );
}
