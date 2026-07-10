import { Skeleton, ChartSkeleton } from "@/components/ui/Skeleton";

export default function WrappedLoading() {
  return (
    <div className="space-y-6">
      <div className="text-center py-6 space-y-3">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <ChartSkeleton />
    </div>
  );
}
