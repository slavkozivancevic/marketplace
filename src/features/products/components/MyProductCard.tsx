"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
    status: string;
    imageUrls: string[];
  };
}

export function MyProductCard({ canWrite, product }: MyProductCardProps) {
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();

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
      {product.imageUrls.length > 0 && (
        <HoverImageCycler
          images={product.imageUrls}
          alt={product.title}
          className="w-full h-48"
        />
      )}
      <div className="p-4 space-y-2">
        <h2 className="font-semibold">{product.title}</h2>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">${product.price.toFixed(2)}</p>
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
