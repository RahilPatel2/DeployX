"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, GitBranch } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";

interface Deployment {
  _id: string;
  projectId: string;
  status: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  environment: string;
  trigger?: "manual" | "redeploy" | "webhook";
  createdAt: string;
  duration?: number;
  projectName?: string; 
}

export function RecentDeploymentsTable({
  projectId,
  initialStatus,
  search,
}: {
  projectId?: string;
  initialStatus?: string;
  search?: string;
}) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.set("projectId", projectId);
  if (initialStatus && initialStatus !== "all") queryParams.set("status", initialStatus);
  if (search && search.trim()) queryParams.set("search", search.trim());

  const qs = queryParams.toString();
  const url = `/api/deployments${qs ? `?${qs}` : ""}`;
  const { data, isLoading } = useSWR<{ deployments: Deployment[] }>(url, {
    refreshInterval: 5000,
  });

  const deployments = data?.deployments || [];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm col-span-full lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Recent Deployments</CardTitle>
          <CardDescription className="text-xs">Latest builds for your {projectId ? 'project' : 'projects'}.</CardDescription>
        </div>
        {!projectId && (
          <Link href="/dashboard/deployments" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View All
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0 mt-3">
        {isLoading && !data ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/30 bg-muted/10">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            ))}
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderKanban className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">No deployments found</p>
            <p className="text-xs text-muted-foreground mt-0.5">Deploy a project to see real build telemetry here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead className="pl-6">Deployment</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {deployments.map((dep) => (
                  <TableRow key={dep._id} className="group hover:bg-muted/40 transition-colors">
                    <TableCell className="pl-6 font-medium">
                      <Link href={`/dashboard/deployments/${dep._id}`} className="hover:underline flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-primary">DP</span>
                        </div>
                        <span className="font-mono">{dep._id.substring(dep._id.length - 7)}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{dep.environment}</span>
                        <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                          <GitBranch className="h-3 w-3" />
                          {dep.branch}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{dep.commitMessage || 'Manual Deploy'}</span>
                          {dep.trigger === 'webhook' && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-purple-500/30 text-purple-400 bg-purple-500/10 shrink-0">
                              Push
                            </Badge>
                          )}
                        </div>
                        {dep.commitHash && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {dep.commitHash.substring(0, 7)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={dep.status} />
                    </TableCell>
                    <TableCell className="text-right pr-6 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
