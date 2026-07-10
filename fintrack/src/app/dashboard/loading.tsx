import { StatCardSkeleton, ChartSkeleton, ListCardSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="space-y-4">
          <ListCardSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
