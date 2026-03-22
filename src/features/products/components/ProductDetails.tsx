"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { ProductWithRelations } from "@/types/types";

interface ProductDetailsProps {
  product: ProductWithRelations;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product }) => {
  return (
    <div className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Title:</strong> {product.title}
          </div>
          <div>
            <strong>Description:</strong> {product.description || "—"}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <Badge variant={getStatusBadgeVariant(product.status)}>
              {product.status}
            </Badge>
          </div>
          <div>
            <strong>Price:</strong> ${product.price.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {product.images?.length ? (
            product.images.map((img) => (
              <div
                key={img.id}
                className="relative w-32 h-32 border rounded overflow-hidden"
              >
                <Image
                  src={img.url}
                  alt={`Product image ${img.key}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))
          ) : (
            <p>No images uploaded</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {product.variants?.length ? (
            product.variants.map((variant) => (
              <div key={variant.id} className="border p-2 rounded">
                <div>
                  <strong>SKU:</strong> {variant.sku} | <strong>Price:</strong>{" "}
                  ${variant.price.toFixed(2)} | <strong>Stock:</strong>{" "}
                  {variant.stock}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {variant.optionValues?.map((opt) => (
                    <Badge key={opt.id}>{opt.value}</Badge>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p>No variants available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "DRAFT":
      return "secondary";
    case "ARCHIVED":
      return "destructive";
    case "PUBLISHED":
    default:
      return "default";
  }
}
