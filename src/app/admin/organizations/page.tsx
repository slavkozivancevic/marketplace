import { cacheTag } from "next/cache";
import { getAllOrganizations } from "@/features/organizations/db/organizations";
import { getOrganizationGlobalTag } from "@/features/organizations/db/cache";
import { OrganizationCard } from "@/features/organizations/components/OrganizationCard";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function AdminOrganizationsPage() {
  const organizations = await fetchOrganizations();

  return (
    <div className="container">
      <PageHeader
        title="Manage Organizations"
        description="View and verify organizations on the platform."
      />

      {organizations.length === 0 ? (
        <Alert>
          <AlertTitle>No organizations found</AlertTitle>
          <AlertDescription>
            There are currently no organizations to display.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchOrganizations() {
  "use cache";

  cacheTag(getOrganizationGlobalTag());

  return getAllOrganizations();
}
