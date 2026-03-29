import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function OrganizationsNotFoundPage() {
  return (
    <div className="container">
      <PageHeader
        title="Not Found"
        description="The requested organization could not be found."
      />
      <Alert>
        <AlertTitle>404 — Not Found</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>The organization you are looking for does not exist.</p>
          <Button asChild>
            <Link href="/admin/organizations">Back to Organizations</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
