"use client";

import { useEffect } from "react";
import { recordInteractionClient } from "../recordClient";

/**
 * Invisible client component that records a VIEW when a product page mounts (or
 * when the visitor soft-navigates to a different product). The server dedupes
 * VIEWs within a 30-minute window, so React StrictMode double-invokes and
 * back/forward revisits don't inflate the log.
 */
export function RecordProductView({ productId }: { productId: string }) {
  useEffect(() => {
    recordInteractionClient("VIEW", productId);
  }, [productId]);
  return null;
}
