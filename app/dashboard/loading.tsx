import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 sm:p-5">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Chart Skeleton */}
      <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </Card>

      {/* Recent Deployments Table Skeleton */}
      <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
          <Skeleton className="h-8 w-20 rounded" />
        </div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-muted/20 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
