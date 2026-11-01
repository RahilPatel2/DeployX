import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2 overflow-x-auto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md shrink-0" />
        ))}
      </div>

      {/* Main Settings Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="space-y-4 pt-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <div className="pt-4 flex justify-end">
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </Card>
    </div>
  );
}
