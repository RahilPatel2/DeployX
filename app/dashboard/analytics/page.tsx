"use client";

import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Layers,
  BarChart3,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const AnalyticsTimelineChart = dynamic(
  () => import("@/components/analytics/analytics-charts").then((m) => m.AnalyticsTimelineChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full flex items-center justify-center">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    ),
  }
);

interface AnalyticsResponse {
  activeProjects: number;
  totalProjects: number;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  inProgressDeployments: number;
  successRate: string;
  successRatePercent: number;
  avgBuildTime: string;
  avgDurationSeconds: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  chartData: Array<{
    date: string;
    time: string;
    deployments: number;
    successful: number;
    failed: number;
  }>;
  frameworks: Array<{
    framework: string;
    count: number;
  }>;
  statusBreakdown: {
    READY: number;
    FAILED: number;
    BUILDING: number;
    QUEUED: number;
    CANCELED: number;
  };
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("7d");
  const { data, isLoading, mutate } = useSWR<AnalyticsResponse>(
    `/api/analytics?range=${range}`
  );

  const totalDeployments = data?.totalDeployments || 0;
  const totalProjects = data?.totalProjects || 0;
  const successfulDeployments = data?.successfulDeployments || 0;
  const failedDeployments = data?.failedDeployments || 0;
  const successRate = data?.successRate || "0.0%";
  const avgBuildTime = data?.avgBuildTime || "0s";
  const chartData = data?.chartData || [];
  const frameworks = data?.frameworks || [];
  const statusBreakdown = data?.statusBreakdown || {
    READY: 0,
    FAILED: 0,
    BUILDING: 0,
    QUEUED: 0,
    CANCELED: 0,
  };

  const hasData = totalDeployments > 0 || totalProjects > 0;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Build telemetry, deployment frequency, success metrics, and framework distributions.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Select value={range} onValueChange={(val) => val && setRange(val)}>
            <SelectTrigger className="w-[130px] sm:w-[140px] h-9 bg-card/60 border-border/50 text-xs">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9 active:scale-95 transition-transform"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {!hasData && !isLoading ? (
        <Card className="bg-card/40 backdrop-blur border-border/50 p-12 text-center flex flex-col items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold">No deployment analytics available yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mt-1 mb-6">
            Once you trigger builds and deployments from your repositories, performance durations,
            success ratios, and activity breakdowns will appear here in real time.
          </p>
          <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "default" })}>
            Create Project & Deploy
          </Link>
        </Card>
      ) : (
        <>
          {/* KPI Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading && !data ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold">{totalProjects}</div>
                )}
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">Configured in workspace</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading && !data ? (
                  <Skeleton className="h-8 w-20 mb-1" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold">{totalDeployments}</div>
                )}
                <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-medium">{successfulDeployments} ready</span>
                  <span>•</span>
                  <span className="text-red-500 font-medium">{failedDeployments} failed</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading && !data ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold">{successRate}</div>
                )}
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                  {successfulDeployments} of {successfulDeployments + failedDeployments} finished builds
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Build Time</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading && !data ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold">{avgBuildTime}</div>
                )}
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                  Min: {data?.minDurationSeconds ? `${data.minDurationSeconds}s` : "-"} • Max:{" "}
                  {data?.maxDurationSeconds ? `${data.maxDurationSeconds}s` : "-"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            {/* Deployment Activity Timeline */}
            <Card className="col-span-full lg:col-span-4 bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Deployment Activity</CardTitle>
                    <CardDescription className="text-xs">
                      Volume of deployment runs over {range === "24h" ? "the last 24 hours" : range === "30d" ? "the last 30 days" : "the last 7 days"}.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {totalDeployments} Runs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full pt-4">
                  {isLoading && !data ? (
                    <Skeleton className="h-full w-full rounded-md" />
                  ) : (
                    <AnalyticsTimelineChart data={chartData} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown & Framework Distribution */}
            <Card className="col-span-full lg:col-span-3 bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Build Status Breakdown</CardTitle>
                <CardDescription className="text-xs">Outcome distribution across deployment runs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ready
                      </span>
                      <span className="font-bold text-sm font-mono">{statusBreakdown.READY}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-500" /> Failed
                      </span>
                      <span className="font-bold text-sm font-mono">{statusBreakdown.FAILED}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-500" /> Building
                      </span>
                      <span className="font-bold text-sm font-mono">{statusBreakdown.BUILDING}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-500" /> Queued
                      </span>
                      <span className="font-bold text-sm font-mono">{statusBreakdown.QUEUED}</span>
                    </div>
                  </div>
                </div>

                {/* Framework Popularity */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Framework Distribution
                  </h4>
                  {frameworks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No framework deployments logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {frameworks.map((fw) => {
                        const pct = totalProjects > 0 ? Math.round((fw.count / totalProjects) * 100) : 0;
                        return (
                          <div key={fw.framework} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{fw.framework}</span>
                              <span className="text-muted-foreground font-mono">{fw.count} projects ({pct}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
