"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
    `/api/analytics?range=${range}`,
    fetcher
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
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Build telemetry, deployment frequency, success metrics, and framework distributions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(val) => val && setRange(val)}>
            <SelectTrigger className="w-[140px] h-9 bg-card/60 border-border/50">
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
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Refresh
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">Configured in workspace</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalDeployments}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-medium">{successfulDeployments} ready</span>
                  <span>•</span>
                  <span className="text-red-500 font-medium">{failedDeployments} failed</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{successRate}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {successfulDeployments} of {successfulDeployments + failedDeployments} finished builds
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Build Time</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{avgBuildTime}</div>
                <p className="text-xs text-muted-foreground mt-1">
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
                    <CardTitle className="text-lg">Deployment Activity</CardTitle>
                    <CardDescription>
                      Volume of deployment runs over {range === "24h" ? "the last 24 hours" : range === "30d" ? "the last 30 days" : "the last 7 days"}.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {totalDeployments} Total Runs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full pt-4">
                  {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-md">
                      No deployments recorded in this time range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorDeployments" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="deployments"
                          name="Total Deployments"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorDeployments)"
                        />
                        <Area
                          type="monotone"
                          dataKey="successful"
                          name="Successful"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorSuccess)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown & Framework Distribution */}
            <Card className="col-span-full lg:col-span-3 bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Build Status Breakdown</CardTitle>
                <CardDescription>Outcome distribution across all deployment executions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ready
                      </span>
                      <span className="font-bold text-sm">{statusBreakdown.READY}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-500" /> Failed
                      </span>
                      <span className="font-bold text-sm">{statusBreakdown.FAILED}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-500" /> Building
                      </span>
                      <span className="font-bold text-sm">{statusBreakdown.BUILDING}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-purple-500" /> Queued
                      </span>
                      <span className="font-bold text-sm">{statusBreakdown.QUEUED}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-primary" /> Framework Distribution
                    </span>
                    <span className="text-xs text-muted-foreground">{frameworks.length} Frameworks</span>
                  </div>

                  {frameworks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No projects configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {frameworks.map((fw) => {
                        const pct = totalProjects > 0 ? Math.round((fw.count / totalProjects) * 100) : 0;
                        return (
                          <div key={fw.framework} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-foreground">{fw.framework}</span>
                              <span className="text-muted-foreground">
                                {fw.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
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
