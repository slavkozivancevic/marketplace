"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export type RelatedProduct = {
  id: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  images: { url: string }[];
  brand: { name: string; logoUrl: string | null } | null;
};

function RelatedProductCard({ product }: { product: RelatedProduct }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const discountPct = isOnSale
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) *
          100,
      )
    : 0;
  const imageUrl = product.images[0]?.url ?? null;

  return (
    <Link href={`/products/${product.id}`} className="block group">
      <div className="rounded-xl overflow-hidden border border-border/40 bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-primary/10 group-hover:border-border/80">
        {/* Image */}
        <div className="relative aspect-4/3 overflow-hidden bg-muted/30">
          {imageUrl ? (
            <>
              {!imgLoaded && <div className="absolute inset-0 z-10 skeleton-shimmer" />}
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onLoad={() => setImgLoaded(true)}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <ImageOff className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Sale badge */}
          {isOnSale && (
            <div className="absolute top-3 left-0 pointer-events-none">
              <span className="bg-linear-to-r from-red-500 to-rose-600 text-white text-xs font-black px-3 py-1 rounded-r-full shadow-lg shadow-red-500/40 tracking-wider uppercase">
                -{discountPct}%
              </span>
            </div>
          )}

          {/* Brand badge */}
          {product.brand && (
            <div className="absolute top-2 right-2 pointer-events-none">
              {product.brand.logoUrl ? (
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2 py-1 shadow-sm">
                  <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white">
                    <Image
                      src={product.brand.logoUrl}
                      alt={product.brand.name}
                      fill
                      sizes="16px"
                      className="object-contain"
                    />
                  </div>
                  <span className="text-xs font-semibold leading-none">
                    {product.brand.name}
                  </span>
                </div>
              ) : (
                <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-2 py-1 shadow-sm">
                  <span className="text-xs font-semibold leading-none">
                    {product.brand.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-1.5">
          <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {product.title}
          </p>
          {isOnSale ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-red-500">
                ${product.price.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                ${product.compareAtPrice!.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-base font-bold">
              ${product.price.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RelatedProductsCarousel({
  products,
}: {
  products: RelatedProduct[];
}) {
  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true }),
  );

  if (products.length === 0) return null;

  return (
    <section className="w-full border-t border-border/50 bg-muted/20">
      <div className="py-12 px-6 lg:px-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Discover More
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              You May Also Like
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            View all →
          </Link>
        </div>

        {/* Carousel */}
        <Carousel
          opts={{ loop: true, align: "start", dragFree: true }}
          plugins={[autoplay.current]}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {products.map((product) => (
              <CarouselItem
                key={product.id}
                className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
              >
                <RelatedProductCard product={product} />
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious className="left-2 active:translate-y-[calc(-50%+1px)]" />
          <CarouselNext className="right-2 active:translate-y-[calc(-50%+1px)]" />
        </Carousel>
      </div>
    </section>
  );
}