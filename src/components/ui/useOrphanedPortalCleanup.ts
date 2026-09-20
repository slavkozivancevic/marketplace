"use client";

import * as React from "react";

/**
 * Takes a modal's portal nodes with it when the component unmounts.
 *
 * Radix portals a dialog's overlay and content into `<body>` with
 * `ReactDOM.createPortal`, and React normally removes those nodes when the
 * portal's owner unmounts. It does not always get there: when the page that
 * owns an OPEN modal is torn down by a navigation, the React tree unmounts (the
 * scroll lock is released, `data-scroll-locked` disappears from `<body>`) while
 * the portal's DOM is left behind, still carrying `data-state="open"`.
 *
 * Confirm-then-navigate is exactly that shape. Deleting a product from its
 * detail page pushes to the product list from inside the delete transition, so
 * the dialog is still open at the moment its page goes away. What stays behind
 * is a `fixed inset-0 z-50` overlay on the page we just landed on: it blurs the
 * shell (globals.css blurs `.app-shell` while any overlay is present), dims it,
 * and swallows every click.
 *
 * Effect cleanup still runs on that unmount, which is the hook this uses. Track
 * the overlay; on the way out, remove the portal wrapper that holds both the
 * overlay and the content, so nothing of the layer survives. When React did its
 * own cleanup the node is already disconnected and this does nothing.
 */
export function useOrphanedPortalCleanup() {
  const overlay = React.useRef<HTMLDivElement | null>(null);

  // A callback ref that only ever stores, never clears. React detaches refs in
  // the mutation phase - before the passive cleanup below runs - so a plain ref
  // object would hold null by the time there is anything to check. Ignoring the
  // detach call keeps the node reachable exactly long enough to ask whether it
  // outlived its owner.
  const trackOverlay = React.useCallback((node: HTMLDivElement | null) => {
    if (node) overlay.current = node;
  }, []);

  React.useEffect(
    () => () => {
      const node = overlay.current;
      overlay.current = null;
      // Still in the document after its owner is gone: React left it behind.
      if (!node?.isConnected) return;
      (node.closest("[data-slot$='-portal']") ?? node).remove();
    },
    [],
  );

  return trackOverlay;
}
