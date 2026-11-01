import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/50 backdrop-blur border-border/50 p-5 space-y-3">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-7 w-28 rounded" />
            <Skeleton className="h-3 w-36 rounded" />
          </Card>
        ))}
      </div>

      {/* Main Chart */}
      <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </Card>
    </div>
  );
}
