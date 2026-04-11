"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface ProductTableProps {
  products: SerializedProductListItem[];
  showActions?: boolean;
  nextCursor?: string;
  onLoadMore?: (cursor: string) => void;
}

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

function ProductTableRow({
  product,
  showActions,
}: {
  product: SerializedProductListItem;
  showActions: boolean;
}) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteProduct(product.id);
      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  const thumbnailUrl = product.images?.[0]?.url;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/admin/products/${product.id}`)}
    >
      <TableCell>
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
      </TableCell>
      <TableCell>{product.title}</TableCell>
      <TableCell>{product.description}</TableCell>
      <TableCell>${product.price.toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(product.status)}>
          {product.status}
        </Badge>
      </TableCell>
      {showActions && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                {/* <Button variant="ghost" size="sm"> */}
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/admin/products/${product.id}/edit`)
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
        </TableCell>
      )}
    </TableRow>
  );
}

export function ProductTable({
  products,
  showActions = false,
  nextCursor,
  onLoadMore,
}: ProductTableProps) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Image</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <ProductTableRow
              key={product.id}
              product={product}
              showActions={showActions}
            />
          ))}
        </TableBody>
      </Table>

      {nextCursor && onLoadMore && (
        <div className="flex justify-center mt-4">
          <Button variant="default" onClick={() => onLoadMore(nextCursor)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}