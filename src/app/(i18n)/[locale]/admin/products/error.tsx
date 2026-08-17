"use client";
import { logger } from "@/lib/logger";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ProductsErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductsErrorPage({
  error,
  reset,
}: ProductsErrorPageProps) {
  // Error boundaries render inside their parent layout, so [locale]/layout's
  // NextIntlClientProvider is still in scope here and useTranslations works.
  const t = useTranslations();

  useEffect(() => {
    logger.error("Products route error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title={t("admin.products")}
        description={t("errorPage.pageDescription")}
      />

      <Alert variant="destructive">
        <AlertTitle>{t("errorPage.title")}</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{t("errorPage.productsBody")}</p>
          <Button type="button" onClick={reset}>
            {t("errorPage.tryAgain")}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
