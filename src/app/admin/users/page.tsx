import { prisma } from "@/core/db/prisma";
import { UserForm } from "@/features/users/components/UserForm";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { memberships: { include: { organization: true } } },
  });

  return (
    <div className="container">
      <PageHeader
        title="Manage Users"
        description="View and update user roles."
      />

      {users.length === 0 ? (
        <Alert>
          <AlertTitle>No users found</AlertTitle>
          <AlertDescription>
            There are currently no users to display.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="border rounded p-4">
              <div className="mb-4">
                <p className="font-semibold">{user.name || user.email}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-sm">Role: {user.role}</p>
              </div>
              <UserForm userId={user.id} currentRole={user.role} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
