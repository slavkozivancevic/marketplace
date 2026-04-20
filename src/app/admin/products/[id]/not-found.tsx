import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ProductNotFoundPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title="Product Not Found"
        description="The requested product could not be found."
      />

      <Alert>
        <AlertTitle>Product not found</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            The product you are looking for does not exist or is unavailable.
          </p>

          <Button asChild>
            <Link href="/admin/products">Back to products</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
