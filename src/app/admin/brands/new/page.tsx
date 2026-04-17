import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BrandForm } from "@/features/brands/components/BrandForm";

export default function NewBrandPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Create New Brand"
          description="Add a new brand to the platform."
        >
          <Button asChild variant="outline">
            <Link href="/admin/brands">Back to Brands</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <BrandForm mode="create" />
      </div>
    </div>
  );
}