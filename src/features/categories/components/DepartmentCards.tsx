import { getTranslations } from "next-intl/server";
import { DepartmentCarousel } from "./DepartmentCarousel";
import type { DepartmentWithImages } from "../db/categories";

interface DepartmentCardsProps {
  departments: DepartmentWithImages[];
}

export async function DepartmentCards({ departments }: DepartmentCardsProps) {
  if (departments.length === 0) return null;

  const t = await getTranslations("categories");

  return (
    <DepartmentCarousel
      departments={departments}
      rows={departments.length > 10 ? 3 : 2}
      titleLabel={t("shopByDepartment")}
      subtitleLabel={t("shopByDepartmentDesc")}
      browseAllLabel={t("browseAll")}
    />
  );
}