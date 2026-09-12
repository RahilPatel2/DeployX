"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLink, GitFork, GitBranch, Clock, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { LogViewer } from "@/components/deployments/log-viewer";

export default async function DeploymentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const deployment = {
    id: params.id,
    project: "portfolio-nextjs",
    commit: "Update hero animation",
    commitHash: "8f31d2a",
    branch: "main",
    status: "ready",
    duration: "42s",
    createdAt: "2 minutes ago",
    url: "portfolio-nextjs-8f31d2a.deployx.app"
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-start justify-between space-y-4 md:space-y-0">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Deployment</h2>
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">{deployment.id}</Badge>
            <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 pointer-events-none">
              Ready
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/dashboard/projects/${deployment.project}`} className="hover:text-foreground transition-colors font-medium text-foreground">
              {deployment.project}
            </Link>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {deployment.branch}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <GitFork className="h-3.5 w-3.5" />
              {deployment.commitHash}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`https://${deployment.url}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Visit Preview <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Build Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between w-full relative">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-border/50 -z-10 -translate-y-1/2" />
              
              {["Queued", "Building", "Uploading", "Ready"].map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-2 bg-card p-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center ring-4 ring-card">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Duration</span>
              <span className="font-medium">{deployment.duration}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Created</span>
              <span className="font-medium">{deployment.createdAt}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">Build Logs</h3>
        <LogViewer deploymentId={deployment.id} status={deployment.status} />
      </div>
    </div>
  );
}
