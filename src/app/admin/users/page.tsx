import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminUsersPage } from "@/features/users/components/AdminUsersPage";
import { getAllUsers } from "@/features/users/db/users";

export default async function AdminUsersRoute() {
  const t = await getTranslations();
  const users = await getAllUsers();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.manageUsers")}
          description={t("admin.manageUsersDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        {users.length === 0 ? (
          <Alert>
            <AlertTitle>{t("admin.noUsers")}</AlertTitle>
            <AlertDescription>
              {t("admin.noUsersDesc")}
            </AlertDescription>
          </Alert>
        ) : (
          <AdminUsersPage users={JSON.parse(JSON.stringify(users))} />
        )}
      </div>
    </div>
  );
}