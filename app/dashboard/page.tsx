import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Activity, Globe, GitBranch } from "lucide-react";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import connectToDatabase from "@/lib/mongodb/client";
import { requireAuth } from "@/lib/auth/session";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";

async function getAnalyticsData() {
  try {
    const userId = await requireAuth();
    await connectToDatabase();
    
    // Concurrently fetch counts
    const [projectCount, deployments] = await Promise.all([
      Project.countDocuments({ userId }),
      Deployment.find({ userId }).select('status createdAt').lean()
    ]);

    const totalDeployments = deployments.length;
    let successCount = 0;
    
    deployments.forEach((d: any) => {
      if (d.status === 'ready' || d.status === 'success') successCount++;
    });

    const successRate = totalDeployments > 0 ? ((successCount / totalDeployments) * 100).toFixed(1) + '%' : '0.0%';

    return {
      activeProjects: projectCount,
      totalDeployments,
      successRate,
      avgBuildTime: "45s" // Mocking avg build time for now
    };
  } catch (error) {
    return { activeProjects: 0, totalDeployments: 0, successRate: "0.0%", avgBuildTime: "0s" };
  }
}

export default async function DashboardPage() {
  const stats = await getAnalyticsData();
  const hasData = stats.activeProjects > 0 || stats.totalDeployments > 0;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          {hasData ? "Good afternoon. Here's what's happening across your projects." : "Welcome to DeployX. Your workspace is empty."}
        </p>
      </div>

      {!hasData && (
        <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm p-8 text-center flex flex-col items-center justify-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
             <FolderKanban className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold">Your workspace is empty</h3>
          <p className="text-muted-foreground max-w-sm">
            Deploy your first project or connect a GitHub repository to get started with DeployX.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Link href="/dashboard/projects/new">
               <Button>Create Project</Button>
            </Link>
          </div>
        </Card>
      )}
      
      {hasData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">{stats.activeProjects}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">{stats.totalDeployments}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              <Globe className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">{stats.successRate}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Build Time</CardTitle>
              <GitBranch className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">{stats.avgBuildTime}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasData && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-full lg:col-span-7 space-y-6">
            <DeploymentActivityChart />
            <RecentDeploymentsTable />
          </div>
        </div>
      )}
    </div>
  );
}
