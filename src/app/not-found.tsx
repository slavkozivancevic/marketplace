import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <>
      <PublicHeader />
      <div className="container px-6">
        <PageHeader
          title="Page Not Found"
          description="The page you are looking for does not exist."
        />

        <Alert>
          <AlertTitle>404 — Not Found</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>The URL you entered does not match any page on this site.</p>
            <Button asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
