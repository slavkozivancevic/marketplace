import { PageHeader } from "@/components/PageHeader";
import { SkeletonHistoryTable } from "@/components/ui/skeleton";

export default function ProductHistoryLoadingPage() {
  return (
    <div className="container my-6">
      <PageHeader
        title="Product History"
        description="Loading product history..."
      />
      <div className="mt-4">
        <SkeletonHistoryTable rows={5} />
      </div>
    </div>
  );
}
