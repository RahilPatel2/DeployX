"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreVertical, LayoutGrid, List, GitFork, GitBranch, FolderKanban } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const mockProjects = [
  {
    id: "proj_1",
    name: "portfolio-nextjs",
    framework: "Next.js",
    status: "ready",
    repo: "RahilPatel2/portfolio",
    branch: "main",
    lastDeploy: new Date(Date.now() - 1000 * 60 * 12),
    url: "portfolio-nextjs.deployx.app"
  },
  {
    id: "proj_2",
    name: "deployx-api",
    framework: "Express",
    status: "building",
    repo: "RahilPatel2/deployx-backend",
    branch: "main",
    lastDeploy: new Date(Date.now() - 1000 * 60 * 2),
    url: "api.deployx.app"
  },
  {
    id: "proj_3",
    name: "docs-site",
    framework: "Vite",
    status: "error",
    repo: "RahilPatel2/docs",
    branch: "main",
    lastDeploy: new Date(Date.now() - 1000 * 60 * 60 * 24),
    url: "docs.deployx.app"
  }
];

export default function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground mt-1">Manage all your applications and their deployments.</p>
        </div>
        <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-8 bg-muted/50 border-border/50" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-muted/50 p-1 rounded-md border border-border/50">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
            <Card key={project.id} className="group bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-lg hover:underline decoration-primary underline-offset-4">
                      {project.name}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${project.status === 'ready' ? 'bg-emerald-500' : project.status === 'building' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                        Production
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Deployments</DropdownMenuItem>
                      <DropdownMenuItem>Settings</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete Project</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pb-4 flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Framework</span>
                    <Badge variant="outline" className="font-mono text-xs">{project.framework}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Repository</span>
                    <span className="flex items-center gap-1 truncate max-w-[150px]">
                      <GitFork className="h-3 w-3" />
                      {project.repo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {project.branch}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/50 text-xs text-muted-foreground flex justify-between items-center bg-muted/20">
                <a href={`https://${project.url}`} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline transition-colors truncate max-w-[180px]">
                  {project.url}
                </a>
                <span>{formatDistanceToNow(project.lastDeploy)} ago</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border bg-card/50 backdrop-blur overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 hidden md:table-cell">Repository</th>
                <th className="px-6 py-4 hidden lg:table-cell">Last Deploy</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {mockProjects.map(project => (
                <tr key={project.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <Link href={`/dashboard/projects/${project.id}`} className="hover:underline hover:text-primary transition-colors">
                      {project.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono mt-1 block md:hidden">
                      {project.repo}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${project.status === 'ready' ? 'bg-emerald-500' : project.status === 'building' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="capitalize">{project.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <GitFork className="h-3.5 w-3.5" />
                      {project.repo}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground">
                    {formatDistanceToNow(project.lastDeploy)} ago
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Deployments</DropdownMenuItem>
                        <DropdownMenuItem>Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete Project</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {mockProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <FolderKanban className="h-6 w-6" />
                      </div>
                      <p>No projects yet.</p>
                      <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Create your first project
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
