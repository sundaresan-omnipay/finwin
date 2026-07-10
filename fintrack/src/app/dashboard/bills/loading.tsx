import { StatCardSkeleton, ListCardSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function BillsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ListCardSkeleton rows={5} />
    </div>
  );
}
