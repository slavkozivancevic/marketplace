"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStickyTabState } from "@/lib/hooks/useStickyTabState";
import { setPreserveAcrossLocaleSwitch } from "@/lib/i18n/localeSwitch";
import { BulkSelectPanel } from "./BulkSelectPanel";
import { CsvImportPanel } from "./CsvImportPanel";
import { TranslationsCsvPanel } from "./TranslationsCsvPanel";
import { ConditionalBulkPanel } from "./ConditionalBulkPanel";

type BrandOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; pathName: string };
type TagOption = { id: string; name: string };

export function BulkProductsManager({
  brands,
  categories,
  tags,
}: {
  brands: BrandOption[];
  categories: CategoryOption[];
  tags: TagOption[];
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [resetKey, setResetKey] = useState(0);
  const [activeTab, setActiveTab] = useStickyTabState("bulkProducts:tab", "conditional");
  const mountedRef = useRef(false);

  // Hard-navigate on language switch so the active tab survives (see ProductForm).
  useEffect(() => {
    setPreserveAcrossLocaleSwitch(true);
    return () => setPreserveAcrossLocaleSwitch(false);
  }, []);

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
      {/* See the matching TabsList in ProductForm.tsx for why both `h-auto!`
          and `*:h-7.75!` are needed here (specificity + a circular
          percentage-height dependency once the list is allowed to wrap). */}
      <TabsList className="w-full justify-start flex-wrap h-auto! gap-1 shrink-0 *:h-7.75!">
        <TabsTrigger value="conditional">{t("bulkProducts.filterExecute")}</TabsTrigger>
        <TabsTrigger value="manage">{t("bulkProducts.selectManage")}</TabsTrigger>
        <TabsTrigger value="import">{t("bulkProducts.importCsv")}</TabsTrigger>
        <TabsTrigger value="translations">{t("bulkProducts.importTranslations")}</TabsTrigger>
      </TabsList>

      <TabsContent forceMount value="conditional" className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6 data-[state=inactive]:hidden">
        <ConditionalBulkPanel key={resetKey} brands={brands} categories={categories} tags={tags} />
      </TabsContent>

      <TabsContent forceMount value="manage" className="flex-1 min-h-0 mt-3 rounded-lg border bg-card p-6 data-[state=inactive]:hidden flex flex-col">
        <BulkSelectPanel key={resetKey} />
      </TabsContent>

      <TabsContent forceMount value="import" className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6 data-[state=inactive]:hidden">
        <CsvImportPanel key={resetKey} />
      </TabsContent>

      <TabsContent forceMount value="translations" className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6 data-[state=inactive]:hidden">
        <TranslationsCsvPanel key={resetKey} />
      </TabsContent>
    </Tabs>
  );
}