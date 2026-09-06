import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
} from "@/components/ui/skeleton";

/**
 * Organization settings is a `space-y-6` stack of <Card>s. Only the first three
 * are unconditional (general, shipping, members); the invite form and pending
 * invites render for OWNER/ADMIN only, so they are left out rather than
 * promising cards a member will never see.
 *
 * Card geometry is <Card>'s own: `gap-4 rounded-xl bg-card py-4 ring-1
 * ring-foreground/10`, with `px-4` on the header and the content.
 */
export default async function OrganizationSettingsLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={2} />
        <PageHeader
          title={t("organization.title")}
          description={t("organization.manage")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="space-y-6">
          {/* General: the header row pairs the title with the verified badge,
              and the body is a one-field `space-y-4` form. */}
          <SettingsCard>
            <div className="flex flex-row items-center justify-between px-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="px-4 space-y-4">
              <FormField labelWidth="w-28" />
              <SkeletonButton className="w-28" />
            </div>
          </SettingsCard>

          {/* Shipping: title plus a `text-sm` subtitle, then a `max-w-md` form
              of a rate field, a free-shipping switch and a threshold field. */}
          <SettingsCard>
            <div className="px-4 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-72" />
            </div>
            <div className="px-4 space-y-4 max-w-md">
              <FormField labelWidth="w-32" spacing="space-y-1.5" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-[18.4px] w-8 rounded-full" />
              </div>
              <FormField labelWidth="w-40" spacing="space-y-1.5" />
              <SkeletonButton className="w-28" />
            </div>
          </SettingsCard>

          {/* Members: a `space-y-2` list of two-line rows with an action group
              on the right. */}
          <SettingsCard>
            <div className="px-4">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="px-4 space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    {/* `text-sm font-medium` over `text-xs text-muted-foreground`. */}
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}

/** <Card>'s own box: `flex flex-col gap-4 rounded-xl bg-card py-4 ring-1`. */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

function FormField({
  labelWidth,
  spacing = "space-y-2",
}: {
  labelWidth: string;
  spacing?: string;
}) {
  return (
    <div className={spacing}>
      <Skeleton className={`h-3.5 ${labelWidth}`} />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}
