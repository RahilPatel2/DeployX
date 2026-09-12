import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Activity, Globe, GitBranch } from "lucide-react";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Good afternoon. Here&apos;s what&apos;s happening across your projects.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-xs text-emerald-500 font-medium mt-1">
              +2 this month
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">184</div>
            <p className="text-xs text-emerald-500 font-medium mt-1">
              +18.4% from last 30 days
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">97.8%</div>
            <p className="text-xs text-emerald-500 font-medium mt-1">
              +1.2% from last 30 days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Build Time</CardTitle>
            <GitBranch className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">42s</div>
            <p className="text-xs text-emerald-500 font-medium mt-1">
              -8.3% from last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-full lg:col-span-7 space-y-6">
          <DeploymentActivityChart />
          <RecentDeploymentsTable />
        </div>
      </div>
    </div>
  );
}
