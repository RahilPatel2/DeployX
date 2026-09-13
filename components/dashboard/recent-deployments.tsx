"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { GitFork, Loader2, FolderKanban } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Deployment {
  _id: string;
  projectId: string;
  status: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  environment: string;
  createdAt: string;
  duration?: number;
  // populated field if possible, else just use projectId
  projectName?: string; 
}

export function RecentDeploymentsTable({ projectId }: { projectId?: string }) {
  const url = projectId ? `/api/deployments?projectId=${projectId}` : `/api/deployments`;
  const { data, error, isLoading } = useSWR<{ deployments: Deployment[] }>(url, fetcher, { refreshInterval: 5000 });

  const deployments = data?.deployments || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm col-span-full lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>Latest builds for your {projectId ? 'project' : 'projects'}.</CardDescription>
        </div>
        {!projectId && (
          <Link href="/dashboard/deployments" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View All
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-4 opacity-50" />
            <p className="text-sm">Loading deployments...</p>
          </div>
        ) : deployments.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderKanban className="h-8 w-8 mb-4 opacity-30" />
            <p className="text-sm">No deployments found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-6">Deployment</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((dep) => (
                <TableRow key={dep._id} className="group cursor-pointer">
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/dashboard/deployments/${dep._id}`} className="hover:underline flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] uppercase font-bold text-primary">DP</span>
                      </div>
                      <div className="flex flex-col">
                         <span>{dep._id.substring(dep._id.length - 7)}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{dep.environment}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {dep.branch}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm truncate max-w-[200px]">{dep.commitMessage || 'Manual Deploy'}</span>
                      {dep.commitHash && (
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <GitFork className="h-3 w-3" />
                          {dep.commitHash.substring(0, 7)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {dep.status === "READY" && <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">Ready</Badge>}
                    {['BUILDING', 'QUEUED'].includes(dep.status) && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 animate-pulse">{dep.status.toLowerCase()}</Badge>}
                    {['FAILED', 'CANCELED'].includes(dep.status) && <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">{dep.status.toLowerCase()}</Badge>}
                  </TableCell>
                  <TableCell className="text-right pr-6 text-muted-foreground text-sm">
                    <div className="flex flex-col items-end">
                      <span>{formatDistanceToNow(new Date(dep.createdAt))} ago</span>
                      <span className="text-xs">{dep.duration ? `${dep.duration}s` : '-'}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </motion.div>
  );
}

function GitBranch({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
