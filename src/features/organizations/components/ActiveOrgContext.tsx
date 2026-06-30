"use client";

import { createContext, useContext } from "react";

/**
 * The id of the org the dashboard is currently acting as (the user's
 * `activeOrgId`). Provided once by the dashboard layout and consumed by
 * org-scoped React Query hooks so their cache keys are isolated per org.
 *
 * Without this, queries like ["orders","org",filters] collide across orgs: the
 * client QueryClient survives the org-switch redirect, so the previous org's
 * cached rows are served (stale-while-revalidate) under the same key - a
 * cross-tenant data flash. Keying on the org makes each org a distinct cache
 * entry, so switching orgs shows the correct data (or a clean load), never
 * another org's.
 */
const ActiveOrgContext = createContext<string | null>(null);

export function ActiveOrgProvider({
  orgId,
  children,
}: {
  orgId: string;
  children: React.ReactNode;
}) {
  return (
    <ActiveOrgContext.Provider value={orgId}>
      {children}
    </ActiveOrgContext.Provider>
  );
}

/**
 * The active org id for keying org-scoped queries. Returns "" outside a
 * provider (e.g. non-dashboard trees) - callers should only rely on it where
 * the dashboard layout is an ancestor.
 */
export function useActiveOrgId(): string {
  return useContext(ActiveOrgContext) ?? "";
}
