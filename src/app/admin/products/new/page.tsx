"use client";

import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewProductPage() {
  return (
    <div className="container">
      <PageHeader
        title="Create New Product"
        description="Fill out the form to add a new product."
      />

      <ProductForm mode="create" />
    </div>
  );
}
