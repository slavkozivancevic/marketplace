"use client";

import * as React from "react";
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
import { Product, ProductStatus } from "@/generated/prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

interface ProductTableProps {
  products: Product[];
  showActions?: boolean;
  nextCursor?: string;
  onLoadMore?: (cursor: string) => void;
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
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.title}</TableCell>
              <TableCell>{product.description}</TableCell>
              <TableCell>
                ${(product.price as Decimal).toNumber().toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    product.status === ProductStatus.PUBLISHED
                      ? "default"
                      : product.status === ProductStatus.DRAFT
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {product.status}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    {/* Options dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Badge variant="secondary">Options</Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Delete button */}
                    <ActionButton
                      title="Delete Product"
                      description={`Are you sure you want to delete ${product.title}?`}
                      confirmText="Delete"
                      onConfirm={() => console.log("Deleting", product.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Badge variant="destructive">Delete</Badge>
                    </ActionButton>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Load More button */}
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
