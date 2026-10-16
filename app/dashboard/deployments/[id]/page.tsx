"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ExternalLink,
  GitFork,
  GitBranch,
  Clock,
  Calendar,
  CheckCircle2,
  Loader2,
  XCircle,
  RotateCw,
  History,
} from "lucide-react";
import Link from "next/link";
import { LogViewer } from "@/components/deployments/log-viewer";
import { use, useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DeploymentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [redeploying, setRedeploying] = useState(false);

  // Poll every 3 seconds if building or queued
  const { data, error, isLoading } = useSWR(`/api/deployments/${params.id}`, fetcher, {
    refreshInterval: (data) => 
      data?.deployment && ['QUEUED', 'BUILDING'].includes(data.deployment.status) ? 3000 : 0
  });

  const handleRedeploy = async () => {
    setRedeploying(true);
    try {
      const res = await fetch(`/api/deployments/${params.id}/redeploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to trigger redeployment");
      }

      const d = await res.json();
      toast.success("Redeployment initiated successfully");
      router.push(`/dashboard/deployments/${d.deployment._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setRedeploying(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !data?.deployment) {
    return <div className="p-8 text-destructive text-center">Failed to load deployment details.</div>;
  }

  const deployment = data.deployment;

  const isTerminal = ['READY', 'FAILED', 'CANCELED'].includes(deployment.status);
  const isFailed = deployment.status === 'FAILED';

  const steps = ["QUEUED", "BUILDING", "READY"];
  const currentStepIndex = steps.indexOf(deployment.status) !== -1 ? steps.indexOf(deployment.status) : (isFailed ? 1 : 0);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-start justify-between space-y-4 md:space-y-0">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Deployment</h2>
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">{deployment._id}</Badge>
            <StatusBadge status={deployment.status} size="default" />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/dashboard/projects/${deployment.projectId}`} className="hover:text-foreground transition-colors font-medium text-foreground">
              View Project
            </Link>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {deployment.branch}
            </span>
            {deployment.commitHash && (
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <GitFork className="h-3.5 w-3.5" />
                {deployment.commitHash.substring(0, 7)}
              </span>
            )}
            {deployment.environment && (
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                {deployment.environment}
              </Badge>
            )}
            {deployment.trigger && (
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                {deployment.trigger}
              </Badge>
            )}
          </div>
          {deployment.commitMessage && (
            <p className="text-xs text-muted-foreground font-mono pt-0.5">
              &quot;{deployment.commitMessage}&quot;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {deployment.url && (
            <a href={`https://${deployment.url}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              Visit Live Site <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleRedeploy}
            disabled={redeploying || !isTerminal}
          >
            {redeploying ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Redeploy
          </Button>
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
              
              {["Queued", "Building", "Ready"].map((step, i) => {
                const isActive = currentStepIndex >= i;
                const isCurrent = currentStepIndex === i && !isTerminal;
                
                return (
                  <div key={step} className="flex flex-col items-center gap-2 bg-card p-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-card ${isActive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'animate-pulse bg-blue-500/20 text-blue-500' : ''}`}>
                      {isActive && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
                    </div>
                    <span className="text-xs font-medium">{step}</span>
                  </div>
                );
              })}
            </div>
            {isFailed && (
               <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-start gap-2">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Deployment failed</p>
                    <p className="text-xs text-destructive/90 mt-0.5">
                      {deployment.errorMessage || "Deployment failed during the build phase. Inspect logs below for details."}
                    </p>
                  </div>
               </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Duration</span>
              <span className="font-medium">{deployment.duration ? `${deployment.duration}s` : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Created</span>
              <span className="font-medium">{formatDistanceToNow(new Date(deployment.createdAt))} ago</span>
            </div>
            {deployment.startedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Started</span>
                <span className="font-medium">{formatDistanceToNow(new Date(deployment.startedAt))} ago</span>
              </div>
            )}
            {deployment.completedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed</span>
                <span className="font-medium">{formatDistanceToNow(new Date(deployment.completedAt))} ago</span>
              </div>
            )}
            {deployment.previousDeploymentId && (
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-muted-foreground flex items-center gap-2"><History className="h-4 w-4" /> Source</span>
                <Link
                  href={`/dashboard/deployments/${deployment.previousDeploymentId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  #{deployment.previousDeploymentId.slice(-6)}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">Build Logs</h3>
        <LogViewer deploymentId={deployment._id} status={deployment.status} />
      </div>
    </div>
  );
}
