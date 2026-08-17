"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureError } from "@/lib/logger";
import { asLocale, type Locale } from "@/i18n/config";

/**
 * Strings are inlined rather than read from messages/<locale>.json because this
 * boundary runs with NextIntlClientProvider out of scope - pulling in the
 * message bundles here would ship every locale's catalogue in the last-resort
 * error chunk. Keep in sync with the `errorPage` namespace in messages/.
 */
const COPY: Record<Locale, { title: string; description: string; retry: string }> = {
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. You can try again.",
    retry: "Try again",
  },
  sr: {
    title: "Došlo je do greške",
    description: "Došlo je do neočekivane greške. Možete pokušati ponovo.",
    retry: "Pokušaj ponovo",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    description: "Ein unerwarteter Fehler ist aufgetreten. Sie können es erneut versuchen.",
    retry: "Erneut versuchen",
  },
  es: {
    title: "Algo ha salido mal",
    description: "Se ha producido un error inesperado. Puedes intentarlo de nuevo.",
    retry: "Intentar de nuevo",
  },
};

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
  // No i18n provider in scope, so the locale comes off the URL's first segment
  // (usePathname returns null if the router context is missing - fall back to
  // the default locale rather than crashing the crash page).
  const pathname = usePathname();
  const locale = asLocale(pathname?.split("/")[1]);
  const copy = COPY[locale];

  useEffect(() => {
    captureError(error, { source: "global-error", digest: error.digest });
  }, [error]);

  return (
    <html lang={locale}>
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
            {copy.title}
          </h1>
          <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 20px" }}>
            {copy.description}
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
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
