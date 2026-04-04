"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { SerializedProductWithRelations } from "@/types/types";

interface ProductDetailsProps {
  product: SerializedProductWithRelations;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product }) => {
  return (
    <div className="space-y-6">
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
          <div>
            <strong>Version:</strong> {product.version}
          </div>
        </CardContent>
      </Card>

      <Separator />

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
            <p className="text-sm text-muted-foreground">No images uploaded</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {product.options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          <span className="text-sm font-medium w-20">{option.name}:</span>
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set(option.values.map((v) => v.value))).map(
              (value) => (
                <Badge key={value} variant="secondary">
                  {value}
                </Badge>
              ),
            )}
          </div>
        </div>
      ))}
      {/* {product.options?.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-20">
                    {option.name}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {option.values.map((v) => (
                      <Badge key={v.id} variant="secondary">
                        {v.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Separator />
        </>
      )} */}

      <Card>
        <CardHeader>
          <CardTitle>Variants ({product.variants?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {product.variants?.length ? (
            product.variants.map((variant) => (
              <div key={variant.id} className="border p-3 rounded space-y-1">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    <strong>SKU:</strong> {variant.sku}
                  </span>
                  <span>
                    <strong>Price:</strong> ${variant.price.toFixed(2)}
                  </span>
                  <span>
                    <strong>Stock:</strong> {variant.stock}
                  </span>
                </div>
                {variant.optionValues?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {variant.optionValues.map((ov) => (
                      <Badge key={ov.id} variant="outline">
                        {ov.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No variants available
            </p>
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
