"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * What the dashboard shell already knows about who is looking: the facts that
 * decide which home cards the dashboard page draws, and the name it greets.
 * Provided by the dashboard layout, which loads them anyway for the sidebar.
 *
 * It exists so a route skeleton - which renders inside the layout but gets no
 * data of its own - can draw the page the viewer is about to get, card for
 * card, instead of a guessed count that jumps when the page lands.
 */
export type DashboardViewer = {
  role: UserRole;
  name: string | null;
  hasActiveOrg: boolean;
  canManagePayouts: boolean;
};

const DashboardViewerContext = createContext<DashboardViewer | null>(null);

export function DashboardViewerProvider({
  viewer,
  children,
}: {
  viewer: DashboardViewer;
  children: React.ReactNode;
}) {
  return <DashboardViewerContext.Provider value={viewer}>{children}</DashboardViewerContext.Provider>;
}

/** The viewer, or null outside the dashboard layout. */
export function useDashboardViewer(): DashboardViewer | null {
  return useContext(DashboardViewerContext);
}
