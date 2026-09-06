import { SkeletonGreetingHeader, SkeletonNavCardGrid } from "@/components/ui/skeleton";

/**
 * Same shape as the admin landing page - see ../../../admin/(home)/loading.tsx.
 *
 * The real grid is four unconditional cards plus up to three that depend on the
 * role and the active org (my products, received orders, payouts), and the
 * quick-links section below it is admin-only. Six is the middle of that range;
 * placeholding the admin section too would promise most visitors a block they
 * never get.
 */
export default function DashboardHomeLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SkeletonGreetingHeader />
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <SkeletonNavCardGrid cards={6} />
      </div>
    </div>
  );
}
