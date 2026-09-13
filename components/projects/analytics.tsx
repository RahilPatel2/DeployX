"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export function Analytics({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Traffic</CardTitle>
          <CardDescription>Daily unique visitors and pageviews.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 py-16 border border-dashed border-border/50 rounded-xl bg-card/20 backdrop-blur min-h-[350px]">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No deployment data yet.</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Once you start receiving traffic to your deployed environments, analytics will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
