import Link from "next/link";
import { cacheTag } from "next/cache";
import { ArrowLeft } from "lucide-react";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BulkProductsManager } from "@/features/products/components/BulkProductsManager";
import { getAllBrands } from "@/features/brands/db/brands";
import { CacheTags } from "@/lib/cache/tags";

export default async function BulkProductsPage() {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Bulk Operations"
          description="Filter products by any combination of conditions, then apply a single action — or manually select and manage, or import from CSV."
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Products
            </Link>
          </Button>
        </PageHeader>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <BulkProductsManager brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}
