import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function UsersNotFoundPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title="Not Found"
        description="The requested user resource could not be found."
      />
      <Alert>
        <AlertTitle>404 — Not Found</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            The user you are looking for does not exist or has been removed.
          </p>
          <Button asChild>
            <Link href="/admin/users">Back to Users</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
