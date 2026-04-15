import { prisma } from "@/core/db/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminUsersPage } from "@/features/users/components/AdminUsersPage";

export default async function AdminUsersRoute() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { memberships: { include: { organization: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Manage Users"
          description="View and update user roles."
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {users.length === 0 ? (
          <Alert>
            <AlertTitle>No users found</AlertTitle>
            <AlertDescription>
              There are currently no users to display.
            </AlertDescription>
          </Alert>
        ) : (
          <AdminUsersPage users={JSON.parse(JSON.stringify(users))} />
        )}
      </div>
    </div>
  );
}