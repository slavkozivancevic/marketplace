import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The invite page looks the token up, then the signed-in user, then compares
 * the two addresses before it renders anything - and it is the first thing a
 * newly invited teammate ever sees, so it should not open on a blank frame.
 *
 * The wrapper is `container max-w-md px-6`, matching the accept branch (the
 * error branches are the wider `container px-6`, but those are the exception).
 * The title and description are static copy, so the real <PageHeader> is used
 * and only the organization name inside the card stays a placeholder.
 */
export default async function InviteLoading() {
  const t = await getTranslations("invite");
  return (
    <div className="container max-w-md px-6">
      <PageHeader title={t("pageTitle")} description={t("pageDesc")} />

      <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
        {/* CardTitle - the organization's name. */}
        <div className="px-4">
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="px-4 space-y-4">
          {/* "Your role" label beside its badge. */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Expiry line, `text-sm text-muted-foreground`. */}
          <Skeleton className="h-3.5 w-56" />
          {/* <InviteActions>: two `flex-1` buttons in a `flex gap-2` row. */}
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
