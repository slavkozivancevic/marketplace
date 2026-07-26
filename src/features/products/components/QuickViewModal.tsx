"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { X, ImageOff, ExternalLink, ShoppingCart } from "lucide-react";
import { RetryImage } from "@/components/RetryImage";

import { useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getProductTitle,
  getProductShortDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonArray } from "@/components/ui/skeleton";
import { StarRating } from "@/features/reviews/components/StarRating";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { QuantityStepper } from "@/features/cart/components/QuantityStepper";
import { buildCartVariantOptions, buildLocalizedText } from "@/features/cart/utils/variantOptions";
import { useCartStore } from "@/features/cart/store/cartStore";
import { SerializedPublicProduct } from "@/types/types";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { cn } from "@/lib/utils";

type QuickViewProduct = SerializedPublicProduct & {
  ratingBreakdown: Record<number, number>;
};

async function fetchProduct(id: string): Promise<QuickViewProduct> {
  const { data } = await axios.get(`/api/products/${id}`);
  return data;
}

interface QuickViewModalProps {
  productId: string | null;
  onClose: () => void;
}

export function QuickViewModal({ productId, onClose }: QuickViewModalProps) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const { currency, currentRate } = useCurrencyStore();
  const { addItem, openCart, items } = useCartStore();

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);

  // Shimmer-until-loaded tracking for slides and thumbs, keyed by media id so
  // entries never collide when the modal is reused across products. The ref
  // callback catches cached images that complete before React attaches onLoad
  // (same pattern as ProductImageCarousel / HoverImageCycler).
  const [loadedSlides, setLoadedSlides] = useState<Set<string>>(new Set());
  const markSlideLoaded = useCallback((id: string) => {
    setLoadedSlides((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set());
  const markThumbLoaded = useCallback((id: string) => {
    setLoadedThumbs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ["product", "quick-view", productId],
    queryFn: () => fetchProduct(productId!),
    enabled: productId != null,
    // Always refetch when the popup opens so admin edits to variant-image
    // links show up immediately instead of being served from cache.
    staleTime: 0,
    refetchOnMount: "always",
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404 ? false : failureCount < 3,
  });

  const isGone =
    axios.isAxiosError(error) && error.response?.status === 404;

  const media = product?.media ?? [];
  const activeVariant = product?.variants.find((v) => v.id === activeVariantId);
  const localTitle = product ? getProductTitle(product, locale) : "";
  const localShortDescription = product ? getProductShortDescription(product, locale) : null;
  const localBrandName = product?.brand ? getBrandName(product.brand, locale) : "";

  const handleSetApi = useCallback((api: CarouselApi) => {
    setCarouselApi(api);
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => setCurrentSlide(api.selectedScrollSnap()));
  }, []);

  // The modal stays mounted (productId just toggles it open), so
  // refetchOnMount fires only once on the grid's initial render. Refetch
  // explicitly each time it opens so freshly-added variants/options show up
  // without a hard reload (matters most for a product that had no variants
  // until the seller added them - its stale payload would otherwise win).
  useEffect(() => {
    if (productId != null) refetch();
  }, [productId, refetch]);

  // Jump to this variant's first media item when selection changes.
  useEffect(() => {
    if (!carouselApi || !activeVariant || media.length === 0) return;
    const variantMediaId = activeVariant.media?.[0]?.mediaId;
    if (!variantMediaId) return;
    const idx = media.findIndex((m) => m.id === variantMediaId);
    if (idx !== -1) carouselApi.scrollTo(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId, carouselApi]);

  const displayPrice = activeVariant ? activeVariant.price : (product?.price ?? 0);
  const displayCompareAt = activeVariant
    ? (activeVariant.compareAtPrice ?? product?.compareAtPrice ?? null)
    : (product?.compareAtPrice ?? null);
  const isOnSale = displayCompareAt != null && displayCompareAt > displayPrice;
  const salePct = isOnSale ? Math.round(((displayCompareAt! - displayPrice) / displayCompareAt!) * 100) : 0;

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const isAllSelected = !hasVariants || activeVariantId !== null;

  const cartQuantity =
    items.find((i) => i.productId === (product?.id ?? "") && i.variantId === (activeVariantId ?? null))?.quantity ?? 0;

  const isOutOfStock = product
    ? hasVariants
      ? !isAllSelected || !activeVariant || activeVariant.stock === 0 || cartQuantity >= activeVariant.stock
      : product.stock !== null && (product.stock === 0 || cartQuantity >= product.stock)
    : true;

  // Requested quantity for the next add - reset per product/variant. Capped at
  // what stock still allows on top of what's already in the cart.
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    setQuantity(1);
  }, [productId, activeVariantId]);
  const stockLimit = product
    ? hasVariants
      ? (activeVariant?.stock ?? 0)
      : product.stock
    : 0;
  const availableToAdd =
    stockLimit === null ? null : Math.max(0, stockLimit - cartQuantity);
  const qty =
    availableToAdd === null
      ? quantity
      : Math.min(quantity, Math.max(1, availableToAdd));

  function handleAdd() {
    if (!product) return;
    // Cart preview is a still - pick the first IMAGE-type media from variant
    // → fall back to product's first IMAGE-type media. Videos are skipped
    // since the cart drawer doesn't play them.
    const variantImageRef = activeVariant?.media.find((vm) => {
      const m = media.find((mm) => mm.id === vm.mediaId);
      return m?.mediaType === "IMAGE";
    });
    const variantFirstImageUrl = variantImageRef
      ? (media.find((m) => m.id === variantImageRef.mediaId)?.url ?? null)
      : null;
    const firstProductImage = media.find((m) => m.mediaType === "IMAGE");
    const firstImage =
      variantFirstImageUrl ?? (firstProductImage?.url ?? null);
    // Snapshot selected options translated for every locale (see AddToCart);
    // SKU is the non-translatable fallback for manual / option-less variants.
    const variantOptions =
      activeVariant && activeVariant.optionValues.length > 0
        ? buildCartVariantOptions(activeVariant.optionValues, product.options)
        : null;
    const variantLabel = activeVariant?.sku ?? null;
    const price = activeVariant ? activeVariant.price : product.price;
    const maxStock = activeVariant ? activeVariant.stock : (product.stock ?? null);
    addItem(
      {
        productId: product.id,
        productTitleI18n: buildLocalizedText((loc) => getProductTitle(product, loc)),
        productTitle: localTitle,
        productImage: firstImage,
        variantId: activeVariant?.id ?? null,
        variantSku: activeVariant?.sku ?? null,
        variantOptions,
        variantLabel,
        price,
        maxStock,
        requiresShipping: product.requiresShipping,
      },
      qty,
    );
    setQuantity(1);
    openCart();
  }

  const handleClose = () => {
    onClose();
    setCurrentSlide(0);
    setActiveVariantId(null);
  };

  if (isGone) {
    return (
      <Dialog open={productId != null} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent
          className="px-6 pt-10 pb-6 w-[calc(100vw-2rem)] max-w-none sm:max-w-md"
          showCloseButton={false}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{t("noLongerAvailable")}</DialogTitle>
          <button
            onClick={handleClose}
            className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 backdrop-blur-xs border border-border/50 p-1 text-muted-foreground hover:text-foreground transition-colors shadow-sm cursor-pointer"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <Alert>
            <AlertTitle>{t("noLongerAvailable")}</AlertTitle>
            <AlertDescription>{t("noLongerAvailableDesc")}</AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={productId != null} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden w-[calc(100vw-2rem)] max-w-none sm:max-w-2xl max-h-[90svh]"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {localTitle || t("quickView")}
        </DialogTitle>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 backdrop-blur-xs border border-border/50 p-1 text-muted-foreground hover:text-foreground transition-colors shadow-sm cursor-pointer"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/*
          Two-column layout on sm+.
          Left panel height = image + thumbnails + bottom-actions - this is the
          "source of truth" for the dialog height on desktop.
          Right panel stretches (items-stretch) to match and its variants
          section fills whatever space is left between header and footer.
        */}
        <div className="flex flex-col sm:flex-row sm:h-[min(85svh,360px)]">

          {/* ── Left: images ── */}
          <div className="shrink-0 sm:w-[44%] flex flex-col border-b sm:border-b-0 sm:border-r border-border/50 bg-muted/10">

            {/* Embla carousel */}
            {isLoading ? (
              <div className="shrink-0">
                <Skeleton className="w-full h-44 sm:h-52 rounded-none" />
                {/* Thumbnail strip placeholder - same box as the real strip
                    (h-9 thumbs + px-1.5 py-1 + border-t) so the left panel
                    doesn't grow when the thumbs stream in. */}
                <div className="flex gap-1 px-1.5 py-1 border-t border-border/50">
                  <SkeletonArray amount={4}>
                    <Skeleton className="h-9 w-9 rounded shrink-0" />
                  </SkeletonArray>
                </div>
              </div>
            ) : media.length > 0 ? (
              <div className="shrink-0">
                <Carousel
                  setApi={handleSetApi}
                  className="w-full"
                  opts={{ loop: media.length > 1 }}
                >
                  <CarouselContent className="ml-0">
                    {media.map((m, idx) => (
                      <CarouselItem key={m.id} className="pl-0">
                        {/* cursor-pointer - purely a swipe affordance hint (this
                            slide has no click handler), matching the drag-to-
                            navigate carousel it sits in. */}
                        <div className="relative w-full h-44 sm:h-52 bg-muted/10 cursor-pointer">
                          {m.mediaType === "VIDEO" ? (
                            <video
                              src={m.url}
                              poster={m.thumbUrl ?? undefined}
                              controls
                              playsInline
                              preload="metadata"
                              className="absolute inset-0 w-full h-full bg-black object-contain"
                            />
                          ) : (
                            <>
                              {!loadedSlides.has(m.id) && (
                                <div className="absolute inset-0 z-10 skeleton-shimmer" />
                              )}
                              <RetryImage
                                src={m.url}
                                alt={`${localTitle} ${idx + 1}`}
                                fill
                                sizes="(max-width:640px) calc(100vw-2rem), 44vw"
                                className="object-contain"
                                priority={idx === 0}
                                showShimmer={false}
                                ref={(img) => {
                                  if (img?.complete && img.naturalWidth > 0)
                                    markSlideLoaded(m.id);
                                }}
                                onLoad={() => markSlideLoaded(m.id)}
                                onError={(_e, willRetry) => {
                                  if (!willRetry) markSlideLoaded(m.id);
                                }}
                              />
                            </>
                          )}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {media.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2 h-7 w-7 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
                      <CarouselNext className="right-2 h-7 w-7 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
                    </>
                  )}
                </Carousel>
              </div>
            ) : (
              <div className="shrink-0 w-full h-44 sm:h-52 flex items-center justify-center text-muted-foreground/40">
                <ImageOff className="h-8 w-8" />
              </div>
            )}

            {/* Thumbnail strip - uses image thumb or video poster URL. */}
            {!isLoading && media.length > 1 && (
              <div className="flex gap-1 px-1.5 py-1 overflow-x-auto shrink-0 border-t border-border/50">
                {media.map((m, i) => {
                  const thumbSrc = m.thumbUrl ?? m.url;
                  return (
                    <button
                      key={m.id}
                      onClick={() => carouselApi?.scrollTo(i)}
                      className={cn(
                        "relative h-9 w-9 shrink-0 overflow-hidden rounded border-2 transition-all cursor-pointer",
                        i === currentSlide ? "border-primary" : "border-transparent hover:border-border",
                      )}
                    >
                      {!loadedThumbs.has(m.id) && (
                        <div className="absolute inset-0 z-10 skeleton-shimmer" />
                      )}
                      <RetryImage
                        src={thumbSrc}
                        alt={`${localTitle} ${i + 1}`}
                        fill
                        sizes="36px"
                        className="object-cover"
                        showShimmer={false}
                        ref={(img) => {
                          if (img?.complete && img.naturalWidth > 0)
                            markThumbLoaded(m.id);
                        }}
                        onLoad={() => markThumbLoaded(m.id)}
                        onError={(_e, willRetry) => {
                          if (!willRetry) markThumbLoaded(m.id);
                        }}
                      />
                      {m.mediaType === "VIDEO" && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-white text-[8px] font-bold">
                          ▶
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom actions - desktop only, pushed to bottom via mt-auto */}
            <div className="mt-auto hidden sm:flex flex-col gap-1.5 px-3 py-2.5 border-t border-border/50">
              {product && (
                <Link
                  href={{
                    pathname: "/products/[slug]",
                    params: {
                      slug:
                        product.translations.find((tr) => tr.locale === locale)?.slug ??
                        product.translations.find((tr) => tr.locale === "en")?.slug ??
                        "",
                    },
                  }}
                  onClick={handleClose}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("viewFullDetails")}
                </Link>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full justify-start px-0 hover:bg-transparent text-muted-foreground hover:text-foreground" onClick={handleClose}>
                {t("cancel")}
              </Button>
            </div>
          </div>

          {/* ── Right: product info ── */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* Fixed header: title, brand, rating, price */}
            <div className="px-3.5 pt-3 pb-2.5 border-b border-border/50 space-y-1 shrink-0">
              {isLoading ? (
                <div className="space-y-1.5 pr-5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-5 w-1/3 mt-0.5" />
                </div>
              ) : product ? (
                <>
                  <h2 className="text-sm font-semibold leading-snug pr-5 line-clamp-2">{localTitle}</h2>
                  {localShortDescription && (
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{localShortDescription}</p>
                  )}
                  {product.brand && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{t("brandLabel")}</span>
                      <BrandLogo
                        src={product.brand.logoUrl}
                        srcDark={product.brand.logoUrlDark}
                        backdrop={product.brand.logoBackdrop}
                        backdropDark={product.brand.logoBackdropDark}
                        name={localBrandName}
                        size={18}
                      />
                      <span className="font-medium text-foreground">{localBrandName}</span>
                    </div>
                  )}
                  {product.ratingCount > 0 && (
                    <div className="flex items-center gap-1">
                      <StarRating rating={product.avgRating} size={11} />
                      <span className="text-[11px] text-muted-foreground">
                        {product.avgRating.toFixed(1)} ({product.ratingCount})
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    {isOnSale ? (
                      <>
                        <span className="text-lg font-bold text-red-500">
                          {formatPrice(convertCents(displayPrice, currency, currentRate()), currency)}
                        </span>
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(convertCents(displayCompareAt!, currency, currentRate()), currency)}
                        </span>
                        <Badge className="bg-red-500 text-white text-[10px] py-0 h-4 hover:bg-red-600">
                          -{salePct}%
                        </Badge>
                      </>
                    ) : (
                      <span className="text-lg font-bold">
                        {formatPrice(convertCents(displayPrice, currency, currentRate()), currency)}
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Scrollable: variant selectors + stock indicator.
                On mobile uses max-h since there's no fixed parent height;
                on desktop uses flex-1 to fill space between header and footer. */}
            <div className="overflow-y-auto max-h-[30svh] sm:max-h-none sm:flex-1 sm:min-h-0 px-4 py-2.5">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ) : product ? (
                <AddToCart
                  product={product}
                  onActiveVariantChange={setActiveVariantId}
                  selectMode
                  hideButton
                />
              ) : null}
            </div>

            {/* Footer: Add to Cart (always) + mobile-only actions */}
            <div className="px-3.5 pt-2.5 pb-3 border-t border-border/50 space-y-1.5 shrink-0">
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : product ? (
                <>
                  {/* Quantity on its own row - sharing a row with the button
                      squeezes the label out of the dialog on narrow widths. */}
                  {!isOutOfStock && isAllSelected && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {tCart("quantity")}
                      </span>
                      <QuantityStepper
                        value={qty}
                        onChange={setQuantity}
                        max={availableToAdd}
                        size="sm"
                      />
                    </div>
                  )}
                  <Button
                    className="w-full h-8 text-sm relative"
                    onClick={handleAdd}
                    disabled={isOutOfStock || !isAllSelected}
                  >
                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                    {!isAllSelected
                      ? tCart("selectAllOptions")
                      : isOutOfStock
                        ? tCart("outOfStockBtn")
                        : tCart("addToCart", {
                            price: formatPrice(convertCents(displayPrice * qty, currency, currentRate()), currency),
                          })}
                    {isOnSale && !isOutOfStock && isAllSelected && (
                      <span className="ml-1.5 bg-primary-foreground/20 text-primary-foreground text-[10px] font-bold px-1 py-0.5 rounded-full">
                        -{salePct}%
                      </span>
                    )}
                  </Button>

                  {/* Mobile-only: View Details + Cancel */}
                  <div className="flex sm:hidden items-center justify-between">
                    <Link
                      href={{
                        pathname: "/products/[slug]",
                        params: {
                          slug:
                            product.translations.find((tr) => tr.locale === locale)?.slug ??
                            product.translations.find((tr) => tr.locale === "en")?.slug ??
                            "",
                        },
                      }}
                      onClick={handleClose}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("viewFullDetails")}
                    </Link>
                    <button
                      onClick={handleClose}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}