import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Root-level not-found. Rendered when [locale]/layout.tsx itself calls
 * notFound() (invalid locale segment), because in that case the inner
 * not-found.tsx can't be wrapped by the layout that just threw. Uses
 * plain next/link (not next-intl's Link) since NextIntlClientProvider
 * isn't in scope here.
 */
export default function RootNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      {/* Soft-404: PPR + the next-intl rewrite commit a 200 before this
          renders, so keep these pages out of the index via noindex. */}
      <meta name="robots" content="noindex, follow" />
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Search className="h-9 w-9 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">
            404 - Not Found
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            The page you are looking for does not exist.
          </h1>
          <p className="text-base text-muted-foreground">
            The URL you entered does not match any page on this site.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild>
            <Link href={`/${DEFAULT_LOCALE}`}>
              <Home className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
