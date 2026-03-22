import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductTable } from "@/components/ui/skeleton";

export default function ProductsLoadingPage() {
  return (
    <div className="container my-6">
      <PageHeader title="Products" description="Loading products list..." />
      <SkeletonProductTable rows={5} showActions />
    </div>
  );
}
