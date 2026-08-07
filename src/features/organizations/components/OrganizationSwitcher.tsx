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

  // Item-aligned content (the default Select position, which overlaps the
  // current item over the trigger when opened) only enforces a *minimum*
  // width equal to the trigger's - long org names still push it wider than
  // the field. Pin it to the trigger's own border-box width so it lines up
  // exactly instead.
  const [triggerNode, setTriggerNode] = useState<HTMLButtonElement | null>(
    null,
  );
  const [triggerWidth, setTriggerWidth] = useState<number>();
  useEffect(() => {
    if (!triggerNode) return;
    const measure = () => setTriggerWidth(triggerNode.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(triggerNode);
    return () => observer.disconnect();
  }, [triggerNode]);

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
        <SelectTrigger
          ref={setTriggerNode}
          className="w-full text-sm cursor-pointer *:data-[slot=select-value]:block! *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate"
        >
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
        <SelectContent
          className="min-w-0"
          style={
            triggerWidth
              ? { width: triggerWidth, maxWidth: triggerWidth }
              : undefined
          }
        >
          {organizations.map((org) => (
            <SelectItem
              key={org.id}
              value={org.id}
              // Radix aligns the open menu by lining up this item's text with
              // the trigger's value text (not by matching box edges) - it's
              // what makes the current selection overlap the trigger instead
              // of shifting sideways on open. The shared item's `pl-1.5` sits
              // closer to its box edge than the trigger's `border + pl-2.5`
              // inset, so left-align them here to match; otherwise pinning
              // this menu's width to the trigger's (below) skews that
              // alignment and the text visibly jumps when it opens.
              className="cursor-pointer pl-2.5 *:[span:last-child]:block *:[span:last-child]:min-w-0 *:[span:last-child]:truncate"
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
