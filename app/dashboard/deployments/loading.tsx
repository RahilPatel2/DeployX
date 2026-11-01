import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeploymentsLoading() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-96 rounded-md" />
        <Skeleton className="h-10 w-full sm:w-44 rounded-md" />
      </div>

      {/* Table Skeleton */}
      <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 w-full rounded-lg bg-muted/20 flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
