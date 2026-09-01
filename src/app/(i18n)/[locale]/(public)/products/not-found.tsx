import { getTranslations } from "next-intl/server";
import { NotFoundContent } from "@/components/layout/not-found-content";
import { Footer } from "@/components/layout/footer";
import { HardNavBoundary } from "@/components/layout/hard-nav-boundary";

export default async function ProductsNotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    // On a not-found page `<Link>` soft-navigation silently does nothing
    // (vercel/next.js#64053), so "Back to Products" and every footer link would
    // be dead until a manual reload. Reachable in practice because the proxy's
    // existence check is deliberately fail-open: during a Neon wake-up
    // /products/<dead-slug> gets through and this page renders.
    <HardNavBoundary>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Next 16 PPR (`cacheComponents`) + the next-intl middleware rewrite
            flush the static shell with HTTP 200 before this dynamic boundary
            renders, so notFound() can't set a 404 status. noindex keeps these
            soft-404 pages out of the search index regardless of the status. */}
        <meta name="robots" content="noindex, follow" />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <NotFoundContent
            eyebrow={t("title")}
            heading={t("page")}
            description={t("productResource")}
            backHref="/products"
            backLabel={t("backToProducts")}
          />
        </div>
        <Footer />
      </div>
    </HardNavBoundary>
  );
}
