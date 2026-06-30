/**
 * Fire-and-forget client recorder for engagement events. Uses `keepalive` so the
 * request survives an immediate navigation, and swallows every error - recording
 * is best-effort and must never affect the UX.
 */
export function recordInteractionClient(
  type: "VIEW" | "ADD_TO_CART",
  productId: string,
): void {
  try {
    void fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, productId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore - never let analytics break the page
  }
}
