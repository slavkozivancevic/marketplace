"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { deleteProduct, duplicateProduct } from "@/features/products/actions/products";
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

const COLS_BASE = "64px minmax(100px,1fr) 120px minmax(150px,2fr) 80px 100px";
const COLS_ACTIONS = COLS_BASE + " 116px";

/**
 * Product table header (rendered outside the virtualizer scroll container).
 */
export function ProductTableHeader({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  const cols = showActions ? COLS_ACTIONS : COLS_BASE;

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: cols }}
    >
      <div role="columnheader" className="truncate">Image</div>
      <div role="columnheader" className="truncate">Title</div>
      <div role="columnheader" className="truncate">Brand</div>
      <div role="columnheader" className="truncate">Description</div>
      <div role="columnheader" className="truncate">Price</div>
      <div role="columnheader" className="truncate">Status</div>
      {showActions && <div role="columnheader" className="truncate">Actions</div>}
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
  const [isDuplicating, startDuplicate] = useTransition();

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

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateProduct(product.id);
      if (!("id" in result)) {
        toast.error(result.message);
        return;
      }
      const copyId = result.id;
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product duplicated", {
        action: {
          label: "Edit copy",
          onClick: () => router.push(`${basePath}/${copyId}/edit`),
        },
      });
    });
  };

  const thumbnailUrl = product.images?.[0]?.url;

  const cols = showActions ? COLS_ACTIONS : COLS_BASE;

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      style={{ gridTemplateColumns: cols }}
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
      <div role="cell">
        {product.brand ? (
          <div className="flex items-center gap-1.5 min-w-0">
            {product.brand.logoUrl && (
              <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-sm border bg-muted">
                <Image
                  src={product.brand.logoUrl}
                  alt={product.brand.name}
                  fill
                  sizes="20px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="truncate text-sm">{product.brand.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`${basePath}/${product.id}/edit`}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isDuplicating}
              onClick={handleDuplicate}
              title="Duplicate product"
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Duplicate</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{product.title}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
