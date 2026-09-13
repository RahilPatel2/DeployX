"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Activity, Globe, GitBranch, Loader2 } from "lucide-react";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";
import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data, isLoading } = useSWR("/api/analytics", fetcher);

  const stats = data || {
    activeProjects: 0,
    totalDeployments: 0,
    successRate: "0.0%",
    avgBuildTime: "0s"
  };

  const hasData = stats.activeProjects > 0 || stats.totalDeployments > 0;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          {hasData ? "Good afternoon. Here's what's happening across your projects." : "Welcome to DeployX. Your workspace is empty."}
        </p>
      </div>

      {!hasData && !isLoading && (
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <div className="text-3xl font-bold">{stats.activeProjects}</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <div className="text-3xl font-bold">{stats.totalDeployments}</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              <Globe className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <div className="text-3xl font-bold">{stats.successRate}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Build Time</CardTitle>
              <GitBranch className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <div className="text-3xl font-bold">{stats.avgBuildTime}</div>
              )}
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
