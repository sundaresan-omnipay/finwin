import { PageHeaderSkeleton, TableRowSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      {/* Filters row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl flex-shrink-0" />
        ))}
      </div>
      {/* Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRowSkeleton key={i} cols={5} />
        ))}
      </div>
    </div>
  );
}
