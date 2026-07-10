import { StatCardSkeleton, ListCardSkeleton, PageHeaderSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";

export default function FuelLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ListCardSkeleton rows={5} />
      </div>
    </div>
  );
}
