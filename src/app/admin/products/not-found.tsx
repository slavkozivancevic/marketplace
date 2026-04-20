import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ProductsNotFoundPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title="Not Found"
        description="The requested products resource could not be found."
      />

      <Alert>
        <AlertTitle>Resource not found</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>The requested products page or resource does not exist.</p>

          <Button asChild>
            <Link href="/admin/products">Back to products</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
