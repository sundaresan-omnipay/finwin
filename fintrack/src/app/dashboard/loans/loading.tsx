import { StatCardSkeleton, ListCardSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function LoansLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <ListCardSkeleton rows={4} />
    </div>
  );
}
