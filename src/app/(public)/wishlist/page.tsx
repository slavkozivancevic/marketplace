import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/core/db/prisma";
import { getWishlistProducts } from "@/features/wishlist/db/wishlist";
import { SerializedProductListItem } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { StarRating } from "@/features/reviews/components/StarRating";
import { Footer } from "@/components/layout/footer";

export default async function WishlistPage() {
  const t = await getTranslations();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) redirect("/sign-in");

  const products = await getWishlistProducts(user.id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("wishlist.title")}
          description={
            products.length > 0
              ? t("wishlist.savedCount", { count: products.length, items: products.length === 1 ? t("wishlist.item") : t("wishlist.items") })
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
                <WishlistProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}

function WishlistProductCard({ product }: { product: SerializedProductListItem }) {
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
        <CardHeader className="p-0 relative">
          {product.images.length > 0 && (
            <HoverImageCycler
              images={product.images.map((img) => img.url)}
              alt={product.title}
              className="w-full h-48 rounded-t"
            />
          )}
          {isOnSale && (
            <div className="absolute top-3 left-0 flex flex-col items-start gap-1 pointer-events-none">
              <span className="bg-linear-to-r from-red-500 to-rose-600 text-white text-sm font-black px-4 py-1.5 rounded-r-full shadow-lg shadow-red-500/50 tracking-wider uppercase">
                -{Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
              </span>
            </div>
          )}
          {product.brand && (
            <div className="absolute top-2 right-2 pointer-events-none">
              {product.brand.logoUrl ? (
                <div className="flex items-center gap-2 bg-background/85 backdrop-blur-sm border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
                  <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border/40 bg-white">
                    <Image
                      src={product.brand.logoUrl}
                      alt={product.brand.name}
                      fill
                      sizes="20px"
                      className="object-contain"
                    />
                  </div>
                  <span className="text-xs font-semibold leading-none">{product.brand.name}</span>
                </div>
              ) : (
                <div className="bg-background/85 backdrop-blur-sm border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
                  <span className="text-xs font-semibold leading-none">{product.brand.name}</span>
                </div>
              )}
            </div>
          )}
          <WishlistButton
            productId={product.id}
            size={16}
            className="absolute bottom-2 right-2"
          />
        </CardHeader>
        <CardContent className="pt-4">
          <CardTitle>{product.title}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
          {product.ratingCount > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <StarRating rating={Math.round(product.avgRating)} size={14} />
              <span className="text-xs text-muted-foreground">
                {product.avgRating.toFixed(1)} ({product.ratingCount})
              </span>
            </div>
          )}
          {isOnSale ? (
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-lg font-semibold text-red-500">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground line-through">
                ${product.compareAtPrice!.toFixed(2)}
              </p>
            </div>
          ) : (
            <p className="text-lg font-semibold mt-2">
              ${product.price.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}