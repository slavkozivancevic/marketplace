import { safeAuth } from "@/lib/auth/safeAuth";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import { prisma } from "@/core/db/prisma";
import { getWishlistProducts } from "@/features/wishlist/db/wishlist";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/features/products/components/ProductCard";

export default async function WishlistPage() {
  // Opt into runtime rendering before next-intl reads the current time for
  // its formatter. Under cacheComponents, touching `new Date()` during a
  // prefetch without first awaiting a dynamic source throws. Mirrors the
  // products page. See next-prerender-runtime-current-time.
  await connection();
  const t = await getTranslations();
  const locale = await getLocale();
  const { userId: clerkUserId } = await safeAuth();
  if (!clerkUserId) redirect(`/${locale}/sign-in`);

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) redirect(`/${locale}/sign-in`);

  const tCrumbs = await getTranslations("breadcrumbs");
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    {
      name: tCrumbs("wishlist"),
      href: getPathname({ href: "/wishlist", locale }),
    },
  ];

  const products = await getWishlistProducts(user.id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("wishlist.title")}
          description={
            products.length > 0
              ? t("wishlist.savedCount", {
                  count: products.length,
                  items:
                    products.length === 1
                      ? t("wishlist.item")
                      : t("wishlist.items"),
                })
              : t("wishlist.savedPlaceholder")
          }
        >
          <Button asChild variant="outline">
            <Link href="/products">{t("wishlist.continueShopping")}</Link>
          </Button>
        </PageHeader>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">{t("wishlist.empty")}</h2>
              <p className="text-muted-foreground max-w-sm">
                {t("wishlist.emptyDesc")}
              </p>
              <Button asChild>
                <Link href="/products">{t("wishlist.browseProducts")}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
