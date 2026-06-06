import "../globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { DEFAULT_LOCALE } from "@/i18n/config";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Minimal root layout for the fallback group - serves the global not-found
 * (e.g. when `[locale]/layout.tsx` calls `notFound()` for an invalid locale
 * segment, or any URL that doesn't match a `[locale]` route at all).
 *
 * Intentionally bare: no providers, no header/footer chrome - those all
 * depend on a valid locale being in scope. `lang` is the default locale,
 * which is correct for this surface because by definition we don't know
 * the user's locale here (the URL didn't carry a valid one).
 */
export default function FallbackRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}