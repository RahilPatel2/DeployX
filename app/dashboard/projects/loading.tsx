import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Filter and Control Bar Skeleton */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card/40 p-3 rounded-xl border border-border/50">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-center">
          <Skeleton className="h-9 w-full sm:w-72 rounded-md" />
          <Skeleton className="h-9 w-full sm:w-44 rounded-md" />
          <Skeleton className="h-9 w-full sm:w-44 rounded-md" />
        </div>
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4 h-64 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-40 rounded" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </Card>
        ))}
      </div>
    </div>
  );
}
