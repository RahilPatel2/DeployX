"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreVertical, LayoutGrid, List, GitFork, GitBranch, FolderKanban } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Project {
  _id: string;
  name: string;
  slug: string;
  framework: string;
  repository: string;
  branch: string;
  productionUrl?: string;
  updatedAt: string;
  // deployment status will be added later, for now default to 'ready'
  status?: string; 
}

export default function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  
  const { data, error, isLoading } = useSWR<{ projects: Project[] }>("/api/projects", fetcher);

  const projects = data?.projects || [];
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.repository.toLowerCase().includes(search.toLowerCase()));

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
          <Input 
            placeholder="Search projects..." 
            className="pl-8 bg-muted/50 border-border/50" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <FolderKanban className="h-8 w-8 opacity-50" />
            <p>Loading projects...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center p-12 text-destructive">
          <p>Failed to load projects. Please try again.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project._id} className="group bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <Link href={`/dashboard/projects/${project._id}`} className="font-semibold text-lg hover:underline decoration-primary underline-offset-4">
                      {project.name}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${project.status === 'error' ? 'bg-red-500' : project.status === 'building' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                        Production
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/dashboard/projects/${project._id}`} />}>View Deployments</DropdownMenuItem>
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
                      {project.repository}
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
                {project.productionUrl ? (
                  <a href={`https://${project.productionUrl}`} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline transition-colors truncate max-w-[180px]">
                    {project.productionUrl}
                  </a>
                ) : (
                  <span>No deployment yet</span>
                )}
                <span>{formatDistanceToNow(new Date(project.updatedAt))} ago</span>
              </CardFooter>
            </Card>
          ))}
          {filteredProjects.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <FolderKanban className="h-6 w-6" />
                </div>
                <p>No projects found.</p>
                {projects.length === 0 && (
                  <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Create your first project
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border bg-card/50 backdrop-blur overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 hidden md:table-cell">Repository</th>
                <th className="px-6 py-4 hidden lg:table-cell">Last Updated</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredProjects.map(project => (
                <tr key={project._id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <Link href={`/dashboard/projects/${project._id}`} className="hover:underline hover:text-primary transition-colors">
                      {project.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono mt-1 block md:hidden">
                      {project.repository}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${project.status === 'error' ? 'bg-red-500' : project.status === 'building' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="capitalize">{project.status || 'ready'}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <GitFork className="h-3.5 w-3.5" />
                      {project.repository}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground">
                    {formatDistanceToNow(new Date(project.updatedAt))} ago
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/dashboard/projects/${project._id}`} />}>View Deployments</DropdownMenuItem>
                        <DropdownMenuItem>Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete Project</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <FolderKanban className="h-6 w-6" />
                      </div>
                      <p>No projects found.</p>
                      {projects.length === 0 && (
                        <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Create your first project
                        </Link>
                      )}
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
