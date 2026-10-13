"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MoreVertical,
  LayoutGrid,
  List,
  GitFork,
  GitBranch,
  FolderKanban,
  ExternalLink,
  Play,
  Trash2,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Project {
  _id: string;
  name: string;
  slug: string;
  framework: string;
  repository: string;
  branch: string;
  productionUrl?: string;
  liveUrl?: string;
  autoDeploy?: boolean;
  updatedAt: string;
  createdAt: string;
  deploymentCount?: number;
  status?: string;
  latestDeployment?: {
    _id: string;
    status: string;
    duration?: number;
    environment?: string;
    branch?: string;
    commitHash?: string;
    commitMessage?: string;
    url?: string;
    createdAt?: string;
  } | null;
}

interface ProjectsApiResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [framework, setFramework] = useState("all");
  const [sortOption, setSortOption] = useState("createdAt-desc");
  const [page, setPage] = useState(1);

  // Modals & Action States
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  // Parse sort parameters
  const [sortField, sortOrder] = sortOption.split("-");

  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.set("search", search.trim());
  if (framework !== "all") queryParams.set("framework", framework);
  queryParams.set("sort", sortField);
  queryParams.set("order", sortOrder);
  queryParams.set("page", String(page));
  queryParams.set("limit", "12");

  const url = `/api/projects?${queryParams.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<ProjectsApiResponse>(url, fetcher, {
    keepPreviousData: true,
  });

  const projects = data?.projects || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  async function handleTriggerDeployment(projectId: string, projectName: string) {
    setDeployingId(projectId);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast.info("A deployment is already queued or in progress for this project.");
        } else {
          toast.error(resData.error || "Failed to trigger deployment.");
        }
      } else {
        toast.success(`Deployment queued for ${projectName}`);
        mutate();
      }
    } catch {
      toast.error("Network error while triggering deployment.");
    } finally {
      setDeployingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const resData = await res.json();
        toast.error(resData.error || "Failed to delete project.");
      } else {
        toast.success(`Project '${projectToDelete.name}' deleted successfully.`);
        setProjectToDelete(null);
        mutate();
      }
    } catch {
      toast.error("Network error while deleting project.");
    } finally {
      setIsDeleting(false);
    }
  }

  function renderStatusBadge(status?: string) {
    const s = (status || "").toUpperCase();
    if (s === "READY") {
      return (
        <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" /> Ready
        </Badge>
      );
    }
    if (s === "BUILDING" || s === "QUEUED") {
      return (
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-1 font-medium animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" /> {s.toLowerCase()}
        </Badge>
      );
    }
    if (s === "FAILED" || s === "CANCELED") {
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1 font-medium">
          <AlertCircle className="h-3 w-3" /> {s.toLowerCase()}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground border-border/50 text-xs">
        No deployments
      </Badge>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground mt-1">
            Manage your applications, deployment history, and live production endpoints.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "default" })}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Link>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card/40 p-3 rounded-xl border border-border/50">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, repository, slug..."
              className="pl-8 bg-muted/40 border-border/50 h-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={framework}
            onValueChange={(val) => {
              if (val) {
                setFramework(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-44 h-9 bg-muted/40 border-border/50">
              <SelectValue placeholder="All Frameworks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              <SelectItem value="Next.js">Next.js</SelectItem>
              <SelectItem value="Vite">Vite</SelectItem>
              <SelectItem value="React">React</SelectItem>
              <SelectItem value="Vue">Vue</SelectItem>
              <SelectItem value="Astro">Astro</SelectItem>
              <SelectItem value="Remix">Remix</SelectItem>
              <SelectItem value="Static HTML">Static HTML</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortOption}
            onValueChange={(val) => {
              if (val) {
                setSortOption(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-44 h-9 bg-muted/40 border-border/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest first</SelectItem>
              <SelectItem value="createdAt-asc">Oldest first</SelectItem>
              <SelectItem value="updatedAt-desc">Recently updated</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs text-muted-foreground hidden lg:inline mr-2">
            {total} {total === 1 ? "project" : "projects"}
          </span>
          <div className="flex bg-muted/50 p-1 rounded-md border border-border/50">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading && projects.length === 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse bg-card/30 border-border/40 h-64 p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted/60 rounded w-1/3" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted/40 rounded w-full" />
                <div className="h-3 bg-muted/40 rounded w-4/5" />
              </div>
              <div className="h-8 bg-muted/30 rounded w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold">Failed to load projects</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            An error occurred while fetching your workspace projects.
          </p>
          <Button variant="outline" onClick={() => mutate()}>
            Try Again
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="bg-card/40 backdrop-blur border-border/50 p-12 text-center flex flex-col items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <FolderKanban className="h-7 w-7" />
          </div>
          {search || framework !== "all" ? (
            <>
              <h3 className="text-xl font-semibold">No matching projects found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-4">
                No projects matched your search criteria. Try modifying or clearing your filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFramework("all");
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold">Your workspace has no projects yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
                Import a GitHub repository to configure automatic framework detection and launch your first website.
              </p>
              <Link href="/dashboard/projects/new" className={buttonVariants({ variant: "default" })}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Project
              </Link>
            </>
          )}
        </Card>
      ) : view === "grid" ? (
        /* Grid View */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasDeployment = Boolean(project.latestDeployment);
            const verifiedUrl = project.liveUrl || project.productionUrl;

            return (
              <Card
                key={project._id}
                className="group bg-card/50 backdrop-blur border-border/50 hover:border-border transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <Link
                          href={`/dashboard/projects/${project._id}`}
                          className="font-semibold text-lg hover:underline decoration-primary underline-offset-4 truncate block"
                          title={project.name}
                        >
                          {project.name}
                        </Link>
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderStatusBadge(project.latestDeployment?.status)}
                          {project.autoDeploy && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 h-4 border-emerald-500/30 text-emerald-500 bg-emerald-500/10 flex items-center gap-1"
                            >
                              <Zap className="h-2.5 w-2.5" /> Auto-deploy
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label="Project actions"
                            />
                          }
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem render={<Link href={`/dashboard/projects/${project._id}`} />}>
                            <FolderKanban className="mr-2 h-4 w-4" /> View Overview
                          </DropdownMenuItem>
                          <DropdownMenuItem render={<Link href={`/dashboard/deployments?projectId=${project._id}`} />}>
                            <Clock className="mr-2 h-4 w-4" /> Deployment History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTriggerDeployment(project._id, project.name)}
                            disabled={deployingId === project._id}
                          >
                            <Play className="mr-2 h-4 w-4" /> Trigger Deploy
                          </DropdownMenuItem>
                          {verifiedUrl && (
                            <DropdownMenuItem
                              onClick={() => window.open(`https://${verifiedUrl}`, "_blank")}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" /> Visit Live Site
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem render={<Link href={`/dashboard/projects/${project._id}/settings`} />}>
                            <Settings className="mr-2 h-4 w-4" /> Project Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setProjectToDelete(project)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">Framework</span>
                      <Badge variant="outline" className="font-mono text-xs font-normal">
                        {project.framework}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">Repository</span>
                      <span
                        className="flex items-center gap-1.5 text-xs truncate max-w-[180px] font-mono text-muted-foreground"
                        title={project.repository}
                      >
                        <GitFork className="h-3 w-3 shrink-0" />
                        {project.repository}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">Branch</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3 shrink-0" />
                        {project.branch}
                      </span>
                    </div>

                    {project.latestDeployment?.commitMessage && (
                      <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground truncate">
                        <span className="font-medium text-foreground/80">Latest: </span>
                        {project.latestDeployment.commitMessage}
                      </div>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="pt-3 pb-3 border-t border-border/50 text-xs text-muted-foreground flex justify-between items-center bg-muted/10">
                  {verifiedUrl ? (
                    <a
                      href={`https://${verifiedUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary hover:underline transition-colors flex items-center gap-1 truncate max-w-[170px]"
                      title={`https://${verifiedUrl}`}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{verifiedUrl}</span>
                    </a>
                  ) : (
                    <span className="italic text-muted-foreground/80">No deployment URL</span>
                  )}
                  <span className="shrink-0">
                    {hasDeployment && project.latestDeployment?.createdAt
                      ? `${formatDistanceToNow(new Date(project.latestDeployment.createdAt))} ago`
                      : `${formatDistanceToNow(new Date(project.updatedAt))} ago`}
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-6">Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Live URL</TableHead>
                <TableHead>Last Deployed</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const verifiedUrl = project.liveUrl || project.productionUrl;

                return (
                  <TableRow key={project._id} className="hover:bg-muted/30">
                    <TableCell className="pl-6 font-medium">
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/projects/${project._id}`}
                          className="font-semibold text-foreground hover:underline decoration-primary underline-offset-4"
                        >
                          {project.name}
                        </Link>
                        <span className="text-xs text-muted-foreground font-mono">{project.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(project.latestDeployment?.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <GitFork className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{project.repository}</span>
                        <span className="text-muted-foreground/60">({project.branch})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {project.framework}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {verifiedUrl ? (
                        <a
                          href={`https://${verifiedUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary hover:underline text-xs flex items-center gap-1 truncate max-w-[160px]"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{verifiedUrl}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {project.latestDeployment?.createdAt
                        ? `${formatDistanceToNow(new Date(project.latestDeployment.createdAt))} ago`
                        : `${formatDistanceToNow(new Date(project.updatedAt))} ago`}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleTriggerDeployment(project._id, project.name)}
                          disabled={deployingId === project._id}
                          title="Trigger manual deployment"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Link href={`/dashboard/projects/${project._id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          View
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => setProjectToDelete(project)}
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({total} total projects)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Project
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{projectToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive/90 space-y-1">
            <p className="font-semibold">Important note:</p>
            <p>
              This will remove all DeployX deployment records, environment bindings, and webhook links.
              Your remote GitHub repository and Cloudflare account will remain safe and untouched.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="ml-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
