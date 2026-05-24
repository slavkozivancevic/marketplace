import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";

export default function ProductsNotFoundPage() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="flex-1 px-6">
        <PageHeader
          title="Not Found"
          description="The page you are looking for does not exist."
        />
        <Alert>
          <AlertTitle>404 - Not Found</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>The products page or resource you requested does not exist.</p>
            <Button asChild>
              <Link href="/products">Back to Products</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
      <Footer />
    </div>
  );
}
