"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, ExternalLink } from "lucide-react";
import Link from "next/link";

const mockDeployments = [
  {
    id: "dpl_9f8a7e6d",
    project: "portfolio-nextjs",
    environment: "Production",
    branch: "main",
    commit: "Update hero animation",
    commitHash: "8f31d2a",
    status: "ready",
    duration: "42s",
    time: "2m ago"
  },
  {
    id: "dpl_3b2c1d4e",
    project: "deployx-api",
    environment: "Preview",
    branch: "feat/auth-v2",
    commit: "Add JWT session handling",
    commitHash: "c6c40c9",
    status: "building",
    duration: "-",
    time: "4m ago"
  },
  {
    id: "dpl_5a4b3c2d",
    project: "docs-site",
    environment: "Production",
    branch: "main",
    commit: "Fix typo in intro",
    commitHash: "a1b2c3d",
    status: "failed",
    duration: "12s",
    time: "1h ago"
  },
  {
    id: "dpl_7e8f9a0b",
    project: "marketing-v2",
    environment: "Preview",
    branch: "design/new-hero",
    commit: "Add Framer Motion",
    commitHash: "9d8e7f6",
    status: "ready",
    duration: "1m 12s",
    time: "3h ago"
  }
];

export function RecentDeploymentsTable() {
  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>Latest builds across all your projects.</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/deployments">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0 mt-4">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-6">Project</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDeployments.map((dep) => (
              <TableRow key={dep.id} className="group cursor-pointer">
                <TableCell className="pl-6 font-medium">
                  <Link href={`/dashboard/deployments/${dep.id}`} className="hover:underline flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] uppercase font-bold text-primary">{dep.project.substring(0, 2)}</span>
                    </div>
                    {dep.project}
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
                    <span className="text-sm truncate max-w-[200px]">{dep.commit}</span>
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Github className="h-3 w-3" />
                      {dep.commitHash}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {dep.status === "ready" && <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">Ready</Badge>}
                  {dep.status === "building" && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 animate-pulse">Building</Badge>}
                  {dep.status === "failed" && <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">Failed</Badge>}
                </TableCell>
                <TableCell className="text-right pr-6 text-muted-foreground text-sm">
                  <div className="flex flex-col items-end">
                    <span>{dep.time}</span>
                    <span className="text-xs">{dep.duration}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
