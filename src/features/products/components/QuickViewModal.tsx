"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { X, ImageOff, ExternalLink, ShoppingCart } from "lucide-react";

import { useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getProductTitle,
  getProductShortDescription,
  type ProductTranslations,
} from "@/features/products/utils/translations";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/features/reviews/components/StarRating";
import { AddToCart } from "@/features/cart/components/AddToCart";
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

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", "quick-view", productId],
    queryFn: () => fetchProduct(productId!),
    enabled: productId != null,
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404 ? false : failureCount < 3,
  });

  const isGone =
    axios.isAxiosError(error) && error.response?.status === 404;

  const images = product?.images ?? [];
  const activeVariant = product?.variants.find((v) => v.id === activeVariantId);
  const localTitle = product
    ? getProductTitle(
        { title: product.title, translations: product.translations as ProductTranslations | null },
        locale,
      )
    : "";
  const localShortDescription = product
    ? getProductShortDescription(
        { shortDescription: product.shortDescription, translations: product.translations as ProductTranslations | null },
        locale,
      )
    : null;

  const handleSetApi = useCallback((api: CarouselApi) => {
    setCarouselApi(api);
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => setCurrentSlide(api.selectedScrollSnap()));
  }, []);

  // Jump to this variant's first image when selection changes
  useEffect(() => {
    if (!carouselApi || !activeVariant || images.length === 0) return;
    const variantImageId = activeVariant.images?.[0]?.imageId;
    if (!variantImageId) return;
    const idx = images.findIndex((img) => img.id === variantImageId);
    if (idx !== -1) carouselApi.scrollTo(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId, carouselApi]);

  const displayPrice = activeVariant ? activeVariant.price : (product?.price ?? 0);
  const displayCompareAt = activeVariant ? activeVariant.compareAtPrice : (product?.compareAtPrice ?? null);
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

  function handleAdd() {
    if (!product) return;
    const variantFirstImageId = activeVariant?.images[0]?.imageId;
    const variantFirstImageUrl = variantFirstImageId
      ? (images.find((img) => img.id === variantFirstImageId)?.url ?? null)
      : null;
    const firstImage = variantFirstImageUrl ?? images[0]?.url ?? null;
    const optionLabel = activeVariant?.optionValues.map((ov) => ov.value).join(" / ");
    const variantLabel = optionLabel || activeVariant?.sku || null;
    const price = activeVariant ? activeVariant.price : product.price;
    const maxStock = activeVariant ? activeVariant.stock : (product.stock ?? null);
    addItem({
      productId: product.id,
      productTitle: localTitle,
      productImage: firstImage,
      variantId: activeVariant?.id ?? null,
      variantSku: activeVariant?.sku ?? null,
      variantLabel,
      price,
      maxStock,
      requiresShipping: product.requiresShipping,
    });
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
        >
          <DialogTitle className="sr-only">{t("noLongerAvailable")}</DialogTitle>
          <button
            onClick={handleClose}
            className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 p-1 text-muted-foreground hover:text-foreground transition-colors shadow-sm cursor-pointer"
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
      >
        <DialogTitle className="sr-only">
          {localTitle || t("quickView")}
        </DialogTitle>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 p-1 text-muted-foreground hover:text-foreground transition-colors shadow-sm cursor-pointer"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/*
          Two-column layout on sm+.
          Left panel height = image + thumbnails + bottom-actions — this is the
          "source of truth" for the dialog height on desktop.
          Right panel stretches (items-stretch) to match and its variants
          section fills whatever space is left between header and footer.
        */}
        <div className="flex flex-col sm:flex-row sm:h-[min(85svh,360px)]">

          {/* ── Left: images ── */}
          <div className="shrink-0 sm:w-[44%] flex flex-col border-b sm:border-b-0 sm:border-r border-border/50 bg-muted/10">

            {/* Embla carousel */}
            {isLoading ? (
              <Skeleton className="w-full h-44 sm:h-52 rounded-none shrink-0" />
            ) : images.length > 0 ? (
              <div className="shrink-0">
                <Carousel
                  setApi={handleSetApi}
                  className="w-full"
                  opts={{ loop: images.length > 1 }}
                >
                  <CarouselContent className="ml-0">
                    {images.map((img, idx) => (
                      <CarouselItem key={img.id} className="pl-0">
                        <div className="relative w-full h-44 sm:h-52 bg-muted/10">
                          <Image
                            src={img.url}
                            alt={`${localTitle} ${idx + 1}`}
                            fill
                            sizes="(max-width:640px) calc(100vw-2rem), 44vw"
                            className="object-contain"
                            priority={idx === 0}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
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

            {/* Thumbnail strip */}
            {!isLoading && images.length > 1 && (
              <div className="flex gap-1 px-1.5 py-1 overflow-x-auto shrink-0 border-t border-border/50">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => carouselApi?.scrollTo(i)}
                    className={cn(
                      "relative h-9 w-9 shrink-0 overflow-hidden rounded border-2 transition-all cursor-pointer",
                      i === currentSlide ? "border-primary" : "border-transparent hover:border-border",
                    )}
                  >
                    <Image src={img.url} alt={`${localTitle} ${i + 1}`} fill sizes="36px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Bottom actions — desktop only, pushed to bottom via mt-auto */}
            <div className="mt-auto hidden sm:flex flex-col gap-1.5 px-3 py-2.5 border-t border-border/50">
              {product && (
                <Link
                  href={`/products/${product.id}`}
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
                    <p className="text-[11px] text-muted-foreground">{t("brandLabel")} {product.brand.name}</p>
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
                            price: formatPrice(convertCents(displayPrice, currency, currentRate()), currency),
                          })}
                    {isOnSale && !isOutOfStock && isAllSelected && (
                      <span className="ml-1.5 bg-white/20 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">
                        -{salePct}%
                      </span>
                    )}
                  </Button>

                  {/* Mobile-only: View Details + Cancel */}
                  <div className="flex sm:hidden items-center justify-between">
                    <Link
                      href={`/products/${product.id}`}
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