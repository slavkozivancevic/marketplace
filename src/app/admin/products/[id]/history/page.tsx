import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache/tags";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
import { SerializedProductHistory } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductHistoryTable } from "@/features/products/components/ProductHistoryTable";

interface ProductHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductHistoryPage({
  params,
}: ProductHistoryPageProps) {
  const t = await getTranslations();
  const { id } = await params;

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProductHistory(ctx.organizationId, ctx.userId, id);

  if (!result) return notFound();

  if (isActionErrorResult(result)) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-6">
          <PageHeader
            title={t("admin.productHistory")}
            description={t("admin.productHistoryDesc", { id })}
          >
            <Button asChild variant="outline">
              <Link href={`/admin/products/${id}`}>{t("admin.backToProduct")}</Link>
            </Button>
          </PageHeader>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
          <Alert variant="destructive">
            <AlertTitle>{t("admin.errorLoadingHistory")}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const history = result as SerializedProductHistory[];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.productHistory")}
          description={t("admin.productHistoryDesc", { id })}
        >
          <Button asChild variant="outline">
            <Link href={`/admin/products/${id}`}>{t("admin.backToProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        {history.length === 0 ? (
          <Alert>
            <AlertTitle>{t("admin.noHistory")}</AlertTitle>
            <AlertDescription>
              {t("admin.noHistoryDesc")}
            </AlertDescription>
          </Alert>
        ) : (
          <ProductHistoryTable history={history} productId={id} />
        )}
      </div>
    </div>
  );
}

async function fetchProductHistory(
  organizationId: string,
  userId: string,
  id: string,
): Promise<SerializedProductHistory[] | { error: boolean; message: string }> {
  "use cache";
  cacheTag(CacheTags.products.byId(organizationId, id));
  cacheTag(CacheTags.products.history(organizationId, id));
  try {
    const repo = productRepository({ organizationId, userId });
    const result = await repo.getHistory(id);
    return result.map((entry) => ({
      ...entry,
      price: Number(entry.price),
    }));
  } catch {
    return { error: true, message: "Failed to load product history" };
  }
}
