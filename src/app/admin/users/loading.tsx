import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonArray,
  SkeletonFilteredListPage,
  SkeletonUserRow,
} from "@/components/ui/skeleton";

export default async function AdminUsersLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.manageUsers")}
          description={t("admin.manageUsersDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <SkeletonFilteredListPage>
          <div className="space-y-4">
            <SkeletonArray amount={6}>
              <SkeletonUserRow />
            </SkeletonArray>
          </div>
        </SkeletonFilteredListPage>
      </div>
    </div>
  );
}
