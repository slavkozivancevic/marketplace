"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppLoader } from "@/components/layout/app-loader";
import { switchOrganizationAction } from "../actions/switchOrganization";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSwitcherProps {
  organizations: Organization[];
  currentOrgId: string;
}

export function OrganizationSwitcher({
  organizations,
  currentOrgId,
}: OrganizationSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const { getToken } = useAuth();

  // Portal the overlay to <body>: the sidebar is a transformed/contained
  // ancestor, which would otherwise trap a `fixed` child inside the sidebar
  // box instead of letting it cover the viewport. `mounted` keeps the portal
  // client-only (no `document` on the server).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSwitch = (orgId: string) => {
    if (orgId === currentOrgId) return;

    startTransition(async () => {
      const result = await switchOrganizationAction(orgId);

      if (result && "error" in result) {
        toast.error(result.message);
        return;
      }

      // No router.refresh() here. The action calls updateTag/revalidatePath,
      // so Next answers it with x-action-revalidated and re-renders the current
      // route itself (server-action-reducer, FreshnessPolicy.RefreshAll) - the
      // user stays on the page and the data is re-scoped to the new org. An
      // extra router.refresh() only queued a second router action behind that
      // one, and about one switch in six then sat with the loader up and the
      // switcher locked until some unrelated state update (on staging: the
      // AppLoader's 10s "stuck" timer) let React commit. Measured 2026-11-09:
      // with the refresh 8 stalls of 10s in 48 switches, without it 0 in 36.
      //
      // The session JWT still names the previous org until it refreshes;
      // resolveRequestContext trusts the DB, so this only spares later
      // requests the claim/DB mismatch path.
      try {
        await getToken({ skipCache: true });
      } catch {
        // Non-fatal: the next natural token refresh still reconciles the claim.
      }
    });
  };

  return (
    <>
      <Select
        value={currentOrgId}
        onValueChange={handleSwitch}
        disabled={isPending}
      >
        {/* The value slot must stay a real <SelectValue>: without it the menu
            silently fails to open. The shared trigger makes the slot
            `display:flex`, which cancels its own `line-clamp-1`; force it back to
            a truncating block so long names get an ellipsis. */}
        <SelectTrigger className="w-full text-sm cursor-pointer *:data-[slot=select-value]:block! *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate">
          {isPending ? (
            <span className="flex min-w-0 items-center gap-2">
              <Loader2 className="size-3.5 animate-spin shrink-0" />
              <span className="min-w-0 truncate">
                {organizations.find((o) => o.id === currentOrgId)?.name}
              </span>
            </span>
          ) : (
            <SelectValue placeholder="Select organization" />
          )}
        </SelectTrigger>
        {/* The shared component already floors popper content at the
            trigger's width; also cap it there so long org names don't flare
            the menu wider than the sidebar - those truncate via the item's
            own ellipsis instead. */}
        <SelectContent className="max-w-(--radix-select-trigger-width)">
          {organizations.map((org) => (
            <SelectItem
              key={org.id}
              value={org.id}
              className="cursor-pointer *:[span:last-child]:block *:[span:last-child]:min-w-0 *:[span:last-child]:truncate"
            >
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Full-page branded loader while the tenant context swaps over -
          portaled to <body> so it escapes the sidebar's containing block and
          covers the whole viewport. */}
      {mounted && createPortal(<AppLoader hidden={!isPending} />, document.body)}
    </>
  );
}
