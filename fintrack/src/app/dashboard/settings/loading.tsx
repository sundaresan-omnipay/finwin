import { Skeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

function SettingsSectionSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
      <Skeleton className="h-4 w-36 mb-2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeaderSkeleton />
      <SettingsSectionSkeleton />
      <SettingsSectionSkeleton />
      <SettingsSectionSkeleton />
    </div>
  );
}
