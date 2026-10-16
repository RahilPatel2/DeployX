import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Activity, Globe, GitBranch, Plus, ArrowUpRight } from "lucide-react";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import { requireAuth } from "@/lib/auth/session";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";

async function getAnalyticsData() {
  try {
    const userId = await requireAuth();
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(String(userId));

    // Concurrently fetch project count and run a single-pass aggregation in MongoDB
    const [projectCount, aggResult] = await Promise.all([
      Project.countDocuments({ userId: userObjectId }),
      Deployment.aggregate([
        { $match: { userId: userObjectId } },
        {
          $group: {
            _id: null,
            totalDeployments: { $sum: 1 },
            readyCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["READY", "ready", "success"]] }, 1, 0],
              },
            },
            failedCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["FAILED", "failed"]] }, 1, 0],
              },
            },
            avgDuration: {
              $avg: {
                $cond: [{ $gt: ["$duration", 0] }, "$duration", null],
              },
            },
          },
        },
      ]),
    ]);

    const stats = aggResult[0] || {
      totalDeployments: 0,
      readyCount: 0,
      failedCount: 0,
      avgDuration: 0,
    };

    const totalDeployments = stats.totalDeployments || 0;
    const readyCount = stats.readyCount || 0;
    const failedCount = stats.failedCount || 0;
    const finished = readyCount + failedCount;
    const successRate = finished > 0 ? ((readyCount / finished) * 100).toFixed(1) + "%" : "0.0%";
    const avgDuration = stats.avgDuration ? Math.round(stats.avgDuration) : 0;
    const avgBuildTime = avgDuration > 0 ? `${avgDuration}s` : "0s";

    return {
      activeProjects: projectCount,
      totalDeployments,
      successRate,
      avgBuildTime,
    };
  } catch {
    return { activeProjects: 0, totalDeployments: 0, successRate: "0.0%", avgBuildTime: "0s" };
  }
}

export default async function DashboardPage() {
  const stats = await getAnalyticsData();
  const hasData = stats.activeProjects > 0 || stats.totalDeployments > 0;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header with Title and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {hasData
              ? "Real-time deployment metrics and activity across your Cloudflare projects."
              : "Welcome to DeployX. Connect a repository to start deploying."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/projects/new"
            className={buttonVariants({
              size: "sm",
              className: "h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-xs",
            })}
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {/* Empty State Card */}
      {!hasData && (
        <Card className="border-border/60 bg-card/40 backdrop-blur p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 rounded-xl shadow-xs">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-lg font-semibold text-foreground">No projects deployed yet</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Import a repository from GitHub or configure framework settings to launch your first edge deployment.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/projects/new"
              className={buttonVariants({ size: "default", className: "h-9 px-5 text-xs font-semibold gap-2" })}
            >
              <span>Deploy First Project</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {/* Analytics KPI Metric Cards */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-xs hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 sm:p-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.activeProjects}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Managed workspaces</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-xs hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 sm:p-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Builds</CardTitle>
              <Activity className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.totalDeployments}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Edge invocations</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-xs hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 sm:p-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Success Rate</CardTitle>
              <Globe className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">{stats.successRate}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Passing pipeline runs</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-xs hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 sm:p-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Avg Build Time</CardTitle>
              <GitBranch className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.avgBuildTime}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Sandbox build duration</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts & Tables */}
      {hasData && (
        <div className="space-y-6">
          <DeploymentActivityChart />
          <RecentDeploymentsTable />
        </div>
      )}
    </div>
  );
}
