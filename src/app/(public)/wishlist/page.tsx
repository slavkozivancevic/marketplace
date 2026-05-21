import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/core/db/prisma";
import { getWishlistProducts } from "@/features/wishlist/db/wishlist";
import { SerializedProductListItem } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { Heart, ImageOff, Video as VideoIcon } from "lucide-react";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { StarRating } from "@/features/reviews/components/StarRating";
import { Footer } from "@/components/layout/footer";
import { cookies } from "next/headers";
import { formatPrice, convertCents } from "@/lib/currency";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import {
  getProductTitle,
  getProductDescription,
  getProductShortDescription,
  type ProductTranslations,
} from "@/features/products/utils/translations";

export default async function WishlistPage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) redirect("/sign-in");

  const products = await getWishlistProducts(user.id);
  const cookieStore = await cookies();
  const rawCurrency = cookieStore.get("NEXT_CURRENCY")?.value ?? "usd";
  const currency: Currency = VALID_CURRENCIES.includes(rawCurrency as Currency) ? (rawCurrency as Currency) : "usd";
  const rate = await getCurrencyRate(currency);

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
                <WishlistProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  currency={currency}
                  rate={rate}
                />
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}

function WishlistProductCard({
  product,
  locale,
  currency,
  rate,
}: {
  product: SerializedProductListItem;
  locale: string;
  currency: Currency;
  rate: number;
}) {
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  const productTranslations = (product.translations as ProductTranslations | null) ?? null;
  const localTitle = getProductTitle({ title: product.title, translations: productTranslations }, locale);
  const localShortDescription = getProductShortDescription(
    { shortDescription: product.shortDescription, translations: productTranslations },
    locale,
  );
  const localDescription = getProductDescription(
    { description: product.description, translations: productTranslations },
    locale,
  );
  const cardDescription = localShortDescription ?? localDescription;

  return (
    <div className="relative h-full">
      <Link href={`/products/${product.id}`} className="block h-full">
        <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50 pt-0 pb-0 gap-0 flex flex-col">
          <CardHeader className="p-0 relative">
            {product.media.length > 0 ? (
              (() => {
                const hoverUrls: string[] = [];
                const videoIndexes = new Set<number>();
                product.media.forEach((m) => {
                  if (m.mediaType === "VIDEO") {
                    videoIndexes.add(hoverUrls.length);
                    hoverUrls.push(m.thumbUrl ?? m.url);
                  } else {
                    hoverUrls.push(m.url);
                  }
                });
                const hasVideo = videoIndexes.size > 0;
                return (
                  <div className="relative w-full h-48">
                    <HoverImageCycler
                      images={hoverUrls}
                      videoIndexes={videoIndexes}
                      alt={localTitle}
                      className="w-full h-48 rounded-t"
                    />
                    {hasVideo && (
                      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
                        <VideoIcon className="h-3 w-3" />
                        Video
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="w-full h-48 rounded-t flex flex-col items-center justify-center gap-2 bg-muted/50">
                <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground/40">No image</span>
              </div>
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
          <CardContent className="pt-3 pb-3 flex flex-col flex-1">
            <div className="flex-1">
              <TruncatedTooltip content={localTitle}>
                <CardTitle className="text-sm leading-snug line-clamp-2">{localTitle}</CardTitle>
              </TruncatedTooltip>
              {cardDescription && (
                <TruncatedTooltip content={cardDescription}>
                  <CardDescription className="line-clamp-2 mt-0.5">{cardDescription}</CardDescription>
                </TruncatedTooltip>
              )}
              {product.ratingCount > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <StarRating rating={product.avgRating} size={14} />
                  <span className="text-xs text-muted-foreground ml-1">
                    {product.avgRating.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({product.ratingCount})
                  </span>
                </div>
              )}
              {isOnSale ? (
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-lg font-semibold text-red-500">
                    {formatPrice(convertCents(product.price, currency, rate), currency)}
                  </p>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatPrice(convertCents(product.compareAtPrice!, currency, rate), currency)}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold mt-2">
                  {formatPrice(convertCents(product.price, currency, rate), currency)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}