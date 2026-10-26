"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useDashboardViewer } from "@/features/users/components/DashboardViewerContext";
import {
  SkeletonGreetingHeader,
  SkeletonNavCardCaption,
  SkeletonNavCardGrid,
} from "@/components/ui/skeleton";
import { dashboardHomeCards } from "./cards";

/**
 * The dashboard home's skeleton, drawn for the viewer the layout already
 * knows: the greeting with their name, exactly their cards (role, active org
 * and payout rights decide which), and the admin-only quick links. Client-side
 * only to read that context; the page itself stays a server component.
 */
export function DashboardHomeSkeleton({ breadcrumbs }: { breadcrumbs: ReactNode }) {
  const t = useTranslations();
  const viewer = useDashboardViewer();
  const cards = dashboardHomeCards(t, {
    role: viewer?.role ?? "USER",
    hasActiveOrg: viewer?.hasActiveOrg ?? false,
    canManagePayouts: viewer?.canManagePayouts ?? false,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SkeletonGreetingHeader
        breadcrumbs={breadcrumbs}
        title={viewer ? t("dashboard.welcome", { name: viewer.name || "User" }) : undefined}
        subtitle={t("dashboard.overview")}
      />
      <div aria-hidden className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <SkeletonNavCardGrid cards={cards} />
        {viewer?.role === "ADMIN" && (
          <div>
            <SkeletonNavCardCaption>{t("dashboard.quickLinks")}</SkeletonNavCardCaption>
            <SkeletonNavCardGrid
              cards={[{ title: t("dashboard.adminPanel"), description: t("dashboard.adminDesc") }]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
