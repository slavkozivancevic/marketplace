"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import { toast } from "@/components/ui/sonner";
import { deleteProduct } from "@/features/products/actions/products";

interface MyProductCardProps {
  canWrite: boolean;
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    compareAtPrice: number | null;
    status: string;
    imageUrls: string[];
    brand?: { name: string; logoUrl: string | null } | null;
  };
}

export function MyProductCard({ canWrite, product }: MyProductCardProps) {
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();

  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteProduct(product.id, "/dashboard/my-products");
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
      <div className="relative">
        {product.imageUrls.length > 0 && (
          <HoverImageCycler
            images={product.imageUrls}
            alt={product.title}
            className="w-full h-48"
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
      </div>
      <div className="p-4 space-y-2">
        <h2 className="font-semibold">{product.title}</h2>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          {isOnSale ? (
            <div className="flex items-baseline gap-1.5">
              <p className="text-sm font-medium text-red-500">${product.price.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground line-through">${product.compareAtPrice!.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-sm font-medium">${product.price.toFixed(2)}</p>
          )}
          <Badge
            variant={
              product.status === "PUBLISHED"
                ? "default"
                : product.status === "DRAFT"
                  ? "secondary"
                  : "destructive"
            }
          >
            {product.status}
          </Badge>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/dashboard/my-products/${product.id}`}>
              {canWrite ? "Edit" : "View"}
            </Link>
          </Button>
          {canWrite && (
            <ActionButton
              title="Delete Product"
              description={`Are you sure you want to delete "${product.title}"?`}
              confirmText="Delete"
              onConfirm={handleDelete}
            >
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                className="w-full"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
