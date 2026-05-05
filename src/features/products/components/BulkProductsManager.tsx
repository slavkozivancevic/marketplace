"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkSelectPanel } from "./BulkSelectPanel";
import { CsvImportPanel } from "./CsvImportPanel";
import { ConditionalBulkPanel } from "./ConditionalBulkPanel";

type BrandOption = { id: string; name: string };

export function BulkProductsManager({ brands }: { brands: BrandOption[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [resetKey, setResetKey] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (pathname === "/admin/products/bulk") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResetKey((k) => k + 1);
    }
  }, [pathname]);

  return (
    <Tabs defaultValue="conditional" className="flex-1 flex flex-col min-h-0">
      <TabsList className="w-full justify-start flex-wrap h-auto gap-1 shrink-0">
        <TabsTrigger value="conditional">{t("bulkProducts.filterExecute")}</TabsTrigger>
        <TabsTrigger value="manage">{t("bulkProducts.selectManage")}</TabsTrigger>
        <TabsTrigger value="import">{t("bulkProducts.importCsv")}</TabsTrigger>
      </TabsList>

      <TabsContent forceMount value="conditional" className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6 data-[state=inactive]:hidden">
        <ConditionalBulkPanel key={resetKey} brands={brands} />
      </TabsContent>

      <TabsContent forceMount value="manage" className="flex-1 min-h-0 mt-3 rounded-lg border bg-card p-6 data-[state=inactive]:hidden flex flex-col">
        <BulkSelectPanel key={resetKey} />
      </TabsContent>

      <TabsContent forceMount value="import" className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6 data-[state=inactive]:hidden">
        <CsvImportPanel key={resetKey} />
      </TabsContent>
    </Tabs>
  );
}