"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ACTIVE_ORG_HEADER,
  ORG_CHANGED,
  OrgChangedError,
} from "../orgScope";

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

// The org the mounted dashboard shell shows, for Server Action requests. Null
// outside the dashboard (storefront, admin), where no action is org-checked.
let actionOrgId: string | null = null;
let actionFetchPatched = false;

/**
 * Next sends every Server Action through the global `fetch` with its own
 * `next-action` header, and offers no hook to add one of ours. So the shell
 * wraps `fetch` once and stamps `ACTIVE_ORG_HEADER` on those requests only -
 * every other request goes through untouched. The server side is
 * `assertActionOrg` (inside `resolveRequestContext`): a save from a tab still
 * showing an org that was switched away elsewhere is refused instead of
 * landing in the other org.
 */
function patchActionFetch() {
  if (actionFetchPatched || typeof window === "undefined") return;
  actionFetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (actionOrgId && init?.headers) {
      const headers = new Headers(init.headers);
      if (headers.has("next-action")) {
        headers.set(ACTIVE_ORG_HEADER, actionOrgId);
        return original(input, { ...init, headers });
      }
    }
    return original(input, init);
  };
}

export function ActiveOrgProvider({
  orgId,
  children,
}: {
  orgId: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    patchActionFetch();
    actionOrgId = orgId || null;
    return () => {
      if (actionOrgId === orgId) actionOrgId = null;
    };
  }, [orgId]);

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

// One shell refresh per stale org at a time: the list, its counts and their
// retries all land on the same 409 within a few hundred ms, and each asking
// for its own refresh would queue a cascade of RSC requests. Time-boxed rather
// than cleared on the org changing, so a refresh that comes back on the SAME
// org (it was switched back meanwhile) does not block the next one for good.
const REFRESH_DEDUPE_MS = 3000;
let lastRefresh: { orgId: string; at: number } | null = null;

/**
 * GET for an org-scoped dashboard route - see `orgScope.ts`. Sends the org this
 * tab is showing; when the route answers that the active org changed
 * elsewhere, re-renders the shell (switcher, `ActiveOrgProvider`, and with it
 * every org-keyed query) on the right org and throws `OrgChangedError`, which
 * the lists draw as their loading skeleton. The other org's rows are never
 * returned, so they never enter the cache under this org's key.
 */
export function useOrgScopedGet() {
  const orgId = useActiveOrgId();
  const router = useRouter();

  return useCallback(
    async <T,>(url: string): Promise<T> => {
      try {
        const { data } = await axios.get<T>(url, {
          headers: orgId ? { [ACTIVE_ORG_HEADER]: orgId } : undefined,
        });
        return data;
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 409 &&
          (error.response.data as { code?: string } | undefined)?.code === ORG_CHANGED
        ) {
          const now = Date.now();
          if (
            !lastRefresh ||
            lastRefresh.orgId !== orgId ||
            now - lastRefresh.at > REFRESH_DEDUPE_MS
          ) {
            lastRefresh = { orgId, at: now };
            router.refresh();
          }
          throw new OrgChangedError();
        }
        throw error;
      }
    },
    [orgId, router],
  );
}
