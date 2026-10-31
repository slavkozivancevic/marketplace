"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUnsavedGuardStore } from "@/lib/forms/unsavedGuard";
import { ConfirmDialog } from "@/components/ActionButton";

/**
 * Renders the unsaved-changes confirmation dialog and intercepts in-app
 * navigation while a form is dirty. Mounted once per app shell (dashboard /
 * admin layouts). The browser's native `beforeunload` alert is intentionally
 * not used; this is the single, styled confirmation surface.
 *
 * Interception is limited to same-origin left-clicks on plain internal links
 * and only kicks in when something is actually dirty, so normal browsing is
 * untouched.
 *
 * "Leave" runs the queued navigation inside a transition and the dialog stays
 * up, its button spinning on "Leaving...", until the next page is on screen -
 * the dialog goes away together with the page it guarded. It used to vanish on
 * the click and leave the user staring at the form they had just chosen to
 * abandon while the next page loaded. A locale switch, which covers the screen
 * with its own loader, finishes its transition at once and closes it straight
 * away.
 */
export function UnsavedChangesGuard() {
  const t = useTranslations("form");
  const router = useRouter();
  const pending = useUnsavedGuardStore((s) => s.pending);
  const guard = useUnsavedGuardStore((s) => s.guard);
  const confirmLeave = useUnsavedGuardStore((s) => s.confirmLeave);
  const stay = useUnsavedGuardStore((s) => s.stay);
  const [isLeaving, startLeaving] = useTransition();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      if (!useUnsavedGuardStore.getState().hasUnsaved()) return;

      const eventTarget = e.target as HTMLElement | null;
      const anchor = eventTarget?.closest("a");
      if (!anchor) return;
      // Card-wide links can wrap nested action buttons that call their own
      // stopPropagation() - too late to stop this capture-phase listener
      // (see the identical guard in NavigationProgress.tsx). A real link
      // click never originates on a nested interactive element, since
      // interactive elements can't validly nest inside an <a>.
      const interactive = eventTarget?.closest("button, [role='button'], input, select, textarea");
      if (interactive && anchor.contains(interactive)) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (e.g. an in-page anchor) - let it through.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      const target = url.pathname + url.search + url.hash;
      if (!guard(() => router.push(target))) {
        e.preventDefault();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [guard, router]);

  return (
    <ConfirmDialog
      open={pending != null || isLeaving}
      onOpenChange={(open) => {
        if (!open) stay();
      }}
      title={t("leaveTitle")}
      description={t("leaveDescription")}
      cancelText={t("stay")}
      confirmText={t("leave")}
      loadingText={t("leaving")}
      confirmVariant="default"
      isLoading={isLeaving}
      onConfirm={() => startLeaving(() => confirmLeave())}
    />
  );
}
