"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitFork, GitBranch, Globe, ExternalLink, Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";
import { use } from "react";

export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  // Mock data for the project
  const project = {
    id: params.id,
    name: "portfolio-nextjs",
    framework: "Next.js",
    status: "ready",
    repo: "RahilPatel2/portfolio",
    branch: "main",
    url: "portfolio-nextjs.deployx.app",
    lastDeploy: "42s",
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Production
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
              <GitFork className="h-3.5 w-3.5" />
              {project.repo}
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {project.branch}
            </span>
            <Badge variant="secondary" className="font-mono text-[10px]">{project.framework}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`https://${project.url}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Visit Site <ExternalLink className="ml-2 h-4 w-4" />
          </a>
          <Button>Deploy</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full mt-6">
        <TabsList className="bg-muted/50 border-b border-border/50 w-full justify-start rounded-none h-12 p-0 px-2 space-x-2">
          <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">Overview</TabsTrigger>
          <TabsTrigger value="deployments" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">Deployments</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">Analytics</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">Logs</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="col-span-2 bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Production Deployment</CardTitle>
                <CardDescription>The deployment currently serving traffic for your domain.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="font-medium text-emerald-500">Ready</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{project.lastDeploy} ago</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Domain</div>
                      <a href={`https://${project.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium hover:underline">
                        {project.url} <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">State</div>
                      <span className="font-medium">Published</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Branch</div>
                      <span className="font-medium flex items-center gap-1"><GitBranch className="h-3 w-3" /> {project.branch}</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Commit</div>
                      <span className="font-mono font-medium flex items-center gap-1"><GitFork className="h-3 w-3" /> 8f31d2a</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="secondary" className="w-full justify-start">View Build Logs</Button>
                <Button variant="secondary" className="w-full justify-start">Manage Domains</Button>
                <Button variant="secondary" className="w-full justify-start">Environment Variables</Button>
              </CardContent>
            </Card>
          </div>
          
          <DeploymentActivityChart />
          <RecentDeploymentsTable />
        </TabsContent>
        
        <TabsContent value="deployments">
          <div className="py-8 text-center text-muted-foreground">Deployments view coming soon...</div>
        </TabsContent>
        <TabsContent value="analytics">
          <div className="py-8 text-center text-muted-foreground">Analytics view coming soon...</div>
        </TabsContent>
        <TabsContent value="logs">
          <div className="py-8 text-center text-muted-foreground">Runtime logs coming soon...</div>
        </TabsContent>
        <TabsContent value="settings">
          <div className="py-8 text-center text-muted-foreground">Project settings coming soon...</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
