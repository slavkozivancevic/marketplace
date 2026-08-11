"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PendingLinkButtonProps = {
  href: ComponentProps<typeof Link>["href"];
  /** Resting label. */
  label: ReactNode;
  /** Label shown while the navigation is in flight (gerund, e.g. "Opening…"). */
  pendingLabel: ReactNode;
  /** Optional resting icon. Swapped for a spinner while navigating. */
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  className?: string;
};

/**
 * A `<Link>` styled as a `<Button>` that shows our standard pending affordance
 * (spinner + gerund label) while the navigation it triggers is in flight.
 *
 * This is the navigation-link counterpart of the action-button convention:
 * both the icon and the text swap during the transition. There is no "clear on
 * success" - a successful navigation unmounts the page, so `pending` resolves
 * by leaving the route.
 */
export function PendingLinkButton({
  href,
  label,
  pendingLabel,
  icon,
  variant,
  className,
}: PendingLinkButtonProps) {
  return (
    // Button's disabled:opacity-50/pointer-events-none only fire on a real
    // `disabled` attribute, which the <a> rendered here can never have. Mirror
    // that look via a data-pending marker the child sets (useLinkStatus only
    // works inside the Link's subtree, not on this element). duration-0 makes
    // it snap in instead of fading via the base `transition-all` - it should
    // land the instant `pending` flips, same as the icon/label swap next to
    // it, not visibly lag a beat behind it.
    <Button
      asChild
      variant={variant}
      className={cn(
        "has-data-[pending=true]:pointer-events-none has-data-[pending=true]:opacity-50 has-data-[pending=true]:duration-0",
        className,
      )}
    >
      <Link href={href}>
        <PendingLinkContent label={label} pendingLabel={pendingLabel} icon={icon} />
      </Link>
    </Button>
  );
}

function PendingLinkContent({
  label,
  pendingLabel,
  icon: Icon,
}: Pick<PendingLinkButtonProps, "label" | "pendingLabel" | "icon">) {
  // `useLinkStatus` reads the pending state of the nearest ancestor <Link>.
  const { pending } = useLinkStatus();
  return (
    <span data-pending={pending} className="contents">
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon aria-hidden />
      ) : null}
      {pending ? pendingLabel : label}
    </span>
  );
}
