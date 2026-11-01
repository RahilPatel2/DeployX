import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewProjectLoading() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded" />
              <Skeleton className="h-4 w-72 rounded" />
            </div>

            {/* Search and filters */}
            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>

            {/* Repository List Skeleton */}
            <div className="rounded-lg border border-border/40 divide-y divide-border/30">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 gap-4">
                  <div className="flex items-start space-x-3.5 flex-1">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-64 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-16 rounded-md shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50 p-5 space-y-4">
            <Skeleton className="h-5 w-36 rounded" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
