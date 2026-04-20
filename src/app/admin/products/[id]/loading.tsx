import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductCard } from "@/components/ui/skeleton";

export default function ProductDetailsLoadingPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title="Product Details"
        description="Loading product details..."
      />
      <SkeletonProductCard />
    </div>
  );
}
