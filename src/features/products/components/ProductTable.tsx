"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { deleteProduct } from "@/features/products/actions/products";
import { SerializedProductListItem } from "@/types/types";

function getStatusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "default" as const;
    case "DRAFT":
      return "secondary" as const;
    default:
      return "destructive" as const;
  }
}

/**
 * Product table header (rendered outside the virtualizer scroll container).
 */
export function ProductTableHeader({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  return (
    <div
      role="row"
      className="grid grid-cols-[64px_1fr_2fr_80px_100px] items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground"
      style={showActions ? { gridTemplateColumns: "64px 1fr 2fr 80px 100px 140px" } : undefined}
    >
      <div role="columnheader">Image</div>
      <div role="columnheader">Title</div>
      <div role="columnheader">Description</div>
      <div role="columnheader">Price</div>
      <div role="columnheader">Status</div>
      {showActions && <div role="columnheader">Actions</div>}
    </div>
  );
}

/**
 * A single product row, compatible with virtualization (uses div instead of tr).
 */
export function ProductTableRow({
  product,
  showActions = false,
  basePath = "/admin/products",
}: {
  product: SerializedProductListItem;
  showActions?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteProduct(product.id);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  const thumbnailUrl = product.images?.[0]?.url;

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      style={{
        gridTemplateColumns: showActions
          ? "64px 1fr 2fr 80px 100px 140px"
          : "64px 1fr 2fr 80px 100px",
      }}
      onClick={() => router.push(`${basePath}/${product.id}`)}
    >
      <div role="cell">
        {thumbnailUrl ? (
          <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
            <Image
              src={thumbnailUrl}
              alt={product.title}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded border bg-muted" />
        )}
      </div>
      <div role="cell" className="truncate">{product.title}</div>
      <div role="cell" className="truncate text-muted-foreground">
        {product.description}
      </div>
      <div role="cell">${product.price.toFixed(2)}</div>
      <div role="cell">
        <Badge variant={getStatusVariant(product.status)}>
          {product.status}
        </Badge>
      </div>
      {showActions && (
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`${basePath}/${product.id}/edit`)
                  }
                >
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ActionButton
              title="Delete Product"
              description={`Are you sure you want to delete "${product.title}"?`}
              confirmText="Delete"
              onConfirm={handleDelete}
            >
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
