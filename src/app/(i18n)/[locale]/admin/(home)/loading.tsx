import {
  Skeleton,
  SkeletonGreetingHeader,
  SkeletonNavCardGrid,
} from "@/components/ui/skeleton";

/**
 * The admin landing page calls `await connection()` and then looks the user up
 * to greet them by name, so it is fully dynamic - nothing renders until that
 * round-trip finishes.
 *
 * Two sections, each an uppercase `text-xs` caption above a two-column card
 * grid: management (11 cards) and quick links (1).
 */
export default function AdminHomeLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SkeletonGreetingHeader />
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        {[11, 1].map((cards, i) => (
          <div key={i}>
            <div className="mb-3 flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
            <SkeletonNavCardGrid cards={cards} />
          </div>
        ))}
      </div>
    </div>
  );
}
