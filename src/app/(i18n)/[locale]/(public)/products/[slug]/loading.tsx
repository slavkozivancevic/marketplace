import { Footer } from "@/components/layout/footer";
import {
  Skeleton,
  SkeletonArray,
  SkeletonButton,
  SkeletonText,
} from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <Skeleton className="mt-2 mb-3 h-4 w-64" />
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="space-y-2">
            <SkeletonText rows={1} size="lg" className="w-64" />
            <SkeletonText rows={1} size="md" className="w-80" />
          </div>
          <SkeletonButton className="w-32" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Gallery */}
            <div className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="flex gap-2">
                <SkeletonArray amount={5}>
                  <Skeleton className="h-16 w-16 rounded-lg" />
                </SkeletonArray>
              </div>
            </div>
            {/* Purchase panel */}
            <div className="space-y-4">
              <SkeletonText rows={1} size="lg" className="w-48" />
              <SkeletonText rows={1} size="lg" className="w-28" />
              <SkeletonText rows={3} size="md" className="w-full" />
              <div className="flex flex-wrap gap-2 pt-2">
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
