import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductCard } from "@/components/ui/skeleton";

export default function ProductDetailsLoadingPage() {
  return (
    <div className="container">
      <PageHeader
        title="Product Details"
        description="Loading product details..."
      />
      <SkeletonProductCard />
    </div>
  );
}
