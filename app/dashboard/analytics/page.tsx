"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground mt-1">Understand how your deployments perform in the real world.</p>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
          <CardDescription>Visitors and performance metrics across all projects.</CardDescription>
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
