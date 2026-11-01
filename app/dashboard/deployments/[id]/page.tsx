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
import { Skeleton } from "@/components/ui/skeleton";
import { LogViewer } from "@/components/deployments/log-viewer";
import { use, useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DeploymentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [redeploying, setRedeploying] = useState(false);

  // Poll every 3 seconds if building or queued
  const { data, error, isLoading } = useSWR(`/api/deployments/${params.id}`, {
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

  if (isLoading && !data?.deployment) {
    return (
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        {/* Pipeline Stepper Skeleton */}
        <Card className="bg-card/50 backdrop-blur border-border/50 p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Overview & Logs Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
          <Card className="md:col-span-2 bg-card/50 backdrop-blur border-border/50 p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-64 w-full rounded-md" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data?.deployment) {
    return <div className="p-8 text-destructive text-center">Failed to load deployment details.</div>;
  }

  const deployment = data.deployment;

  const isTerminal = ['READY', 'FAILED', 'CANCELED'].includes(deployment.status);
  const isFailed = deployment.status === 'FAILED';
  const isReady = deployment.status === 'READY';

  // Truthful 4-step pipeline: Queued -> Building -> Uploading -> Deployed
  const PIPELINE_STAGES = [
    { key: "queued", label: "Queued" },
    { key: "building", label: "Building" },
    { key: "uploading", label: "Uploading" },
    { key: "deployed", label: "Deployed" },
  ];

  const currentStage = deployment.stage || (
    deployment.status === "QUEUED" ? "queued" :
    deployment.status === "READY" ? "deployed" :
    deployment.status === "FAILED" ? "failed" :
    "building"
  );

  let currentStageIndex = 0;
  if (currentStage === "queued") currentStageIndex = 0;
  else if (["cloning", "installing", "building"].includes(currentStage)) currentStageIndex = 1;
  else if (currentStage === "uploading") currentStageIndex = 2;
  else if (currentStage === "deployed" || isReady) currentStageIndex = 3;
  else if (isFailed) {
    if (deployment.stage === "uploading") currentStageIndex = 2;
    else currentStageIndex = 1;
  }

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
          {deployment.url && isReady && (
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
              
              {PIPELINE_STAGES.map((step, i) => {
                const isStepFailed = isFailed && currentStageIndex === i;
                const isActive = currentStageIndex >= i && !isStepFailed;
                const isCurrent = currentStageIndex === i && !isTerminal;
                
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 bg-card p-2 z-10">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center ring-4 ring-card transition-colors ${
                        isStepFailed
                          ? 'bg-destructive/20 text-destructive'
                          : isActive && !isCurrent
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : isCurrent
                          ? 'animate-pulse bg-blue-500/20 text-blue-500 ring-blue-500/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isStepFailed ? (
                        <XCircle className="h-4 w-4" />
                      ) : isActive && !isCurrent ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isStepFailed
                          ? 'text-destructive font-semibold'
                          : isCurrent
                          ? 'text-blue-500 font-semibold'
                          : isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
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
