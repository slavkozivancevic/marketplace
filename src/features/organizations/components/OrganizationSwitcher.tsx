"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

      // The switch updated the DB + Clerk publicMetadata, but the live session
      // JWT still carries the previous activeOrgId claim. Force a fresh token
      // so the very next server render (resolveRequestContext) scopes to the
      // new org immediately, then re-render the current route in place - the
      // user stays on the same page with freshly-scoped data. Keeping the
      // transition open across the refresh holds the loader until the new RSC
      // payload is committed.
      try {
        await getToken({ skipCache: true });
      } catch {
        // Non-fatal: the next natural token refresh still reconciles the claim.
      }
      router.refresh();
    });
  };

  return (
    <>
      <Select
        value={currentOrgId}
        onValueChange={handleSwitch}
        disabled={isPending}
      >
        {/* The value slot must stay a real <SelectValue>: Radix's item-aligned
            content positions itself against that node, and without it the menu
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
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id} className="cursor-pointer">
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