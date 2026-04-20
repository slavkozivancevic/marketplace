import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductTable } from "@/components/ui/skeleton";

export default function ProductsLoadingPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader title="Products" description="Loading products list..." />
      <SkeletonProductTable rows={5} showActions />
    </div>
  );
}
