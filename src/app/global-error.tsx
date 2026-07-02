"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/logger";

/**
 * Root error boundary - the last-resort fallback when an error escapes every
 * nested boundary (it replaces the root layout, so it must render its own
 * <html>/<body> and can't assume providers/i18n). Reports the crash centrally
 * and offers a retry. Kept deliberately plain: it must render even when the app
 * shell itself failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { source: "global-error", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f4f4f5",
          color: "#09090b",
        }}
      >
        <div style={{ textAlign: "center", padding: "32px", maxWidth: "420px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 20px" }}>
            An unexpected error occurred. You can try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              background: "#09090b",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
