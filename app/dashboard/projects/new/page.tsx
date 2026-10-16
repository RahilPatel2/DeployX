"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Lock,
  Globe,
  GitBranch,
  GitFork,
  Box,
  Loader2,
  ArrowLeft,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FolderTree,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "An error occurred while fetching data.");
  }
  return data;
};

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  default_branch: string;
  private: boolean;
  visibility?: "public" | "private";
  html_url?: string;
  language?: string | null;
  updated_at?: string;
  owner?: {
    login: string;
    avatar_url?: string;
  };
}

interface GithubBranch {
  name: string;
  isDefault?: boolean;
  protected?: boolean;
}

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [projectName, setProjectName] = useState("");
  const [framework, setFramework] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [rootDirectory, setRootDirectory] = useState("");
  const [packageManager, setPackageManager] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm");
  const [deploymentMode, setDeploymentMode] = useState<"static" | "ssr">("static");
  const [detectedRoots, setDetectedRoots] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");

  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get("success");
    if (error) {
      toast.error(error);
    }
    if (success) {
      toast.success(success);
    }
  }, [searchParams]);

  const { data: statusData, isLoading: statusLoading } = useSWR("/api/integrations/github/status", fetcher);
  const isConnected = statusData?.connected;

  // Fetch real repositories from GitHub API via our backend
  const reposUrl = isConnected
    ? `/api/integrations/github/repos?page=${currentPage}&per_page=30&visibility=${visibilityFilter}`
    : null;

  const {
    data: reposData,
    error: reposError,
    isLoading: reposLoading,
    mutate: mutateRepos,
  } = useSWR(reposUrl, fetcher);

  const allRepos: GithubRepo[] = reposData?.repos || [];
  const hasMore = reposData?.hasMore || false;

  // Client-side quick filter
  const filteredRepos = allRepos.filter((r: GithubRepo) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      r.name.toLowerCase().includes(query) ||
      r.full_name.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query))
    );
  });

  // Fetch real branches for selected repository
  const {
    data: branchesData,
    isLoading: branchesLoading,
    error: branchesError,
  } = useSWR(
    selectedRepo ? `/api/integrations/github/branches?repo=${encodeURIComponent(selectedRepo.full_name)}` : null,
    fetcher,
    {
      onSuccess(data) {
        if (data?.defaultBranch) {
          setSelectedBranch(data.defaultBranch);
        }
      },
    }
  );

  // Framework detection hook with rootDirectory support
  const { isLoading: frameworkLoading } = useSWR(
    selectedRepo && selectedBranch
      ? `/api/integrations/github/framework?repo=${encodeURIComponent(selectedRepo.full_name)}&branch=${encodeURIComponent(selectedBranch)}&rootDir=${encodeURIComponent(rootDirectory)}`
      : null,
    fetcher,
    {
      onSuccess(fw) {
        if (fw) {
          setFramework(fw.framework || "Next.js");
          setBuildCommand(fw.buildCommand || "");
          setOutputDirectory(fw.outputDirectory || ".next");
          setInstallCommand(fw.installCommand || "npm install");
          if (fw.packageManager) setPackageManager(fw.packageManager);
          if (fw.deploymentMode) setDeploymentMode(fw.deploymentMode);
          if (Array.isArray(fw.detectedRoots)) setDetectedRoots(fw.detectedRoots);
          if (Array.isArray(fw.warnings)) setWarnings(fw.warnings);
        }
      },
    }
  );

  const handleSelectRepo = (repo: GithubRepo) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch || "main");
    setProjectName(repo.name);
    setRootDirectory("");
    setDetectedRoots([]);
    setWarnings([]);
  };

  const handleCreateProject = async () => {
    if (!selectedRepo || !projectName || !selectedBranch) {
      toast.error("Please fill all required fields before proceeding.");
      return;
    }

    setIsDeploying(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          repository: selectedRepo.full_name,
          branch: selectedBranch,
          framework: framework || "Next.js",
          buildCommand: buildCommand || "",
          outputDirectory: outputDirectory || ".next",
          installCommand: installCommand || "npm install",
          rootDirectory: rootDirectory.trim(),
          packageManager,
          deploymentMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409 && err.existingProjectId) {
          toast.error(err.error);
          router.push(`/dashboard/projects/${err.existingProjectId}`);
          return;
        }
        throw new Error(err.error || "Failed to create project");
      }

      const data = await res.json();
      toast.success("Project imported successfully!");
      router.push(`/dashboard/projects/${data.project._id}`);
    } catch (error: unknown) {
      console.error("Project creation error:", error);
      const msg = error instanceof Error ? error.message : "An error occurred while importing the project";
      toast.error(msg);
      setIsDeploying(false);
    }
  };

  const handleConnect = () => {
    window.location.assign("/api/integrations/github/connect?returnTo=/dashboard/projects/new");
  };

  // STEP 2: Configure & Select Branch
  if (selectedRepo) {
    const branches: GithubBranch[] = branchesData?.branches || [];
    const isRepoEmpty = branchesData?.isEmpty || false;

    return (
      <>
        <div className="flex flex-col space-y-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit mb-2 text-muted-foreground"
            onClick={() => setSelectedRepo(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Repositories
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Configure Project</h2>
            <Badge variant="outline" className="font-mono text-xs">
              {selectedRepo.private ? "Private" : "Public"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Configure project name, choose a production branch, and review build settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> Project Configuration
                </CardTitle>
                <CardDescription>
                  Importing repository <span className="font-semibold text-foreground font-mono">{selectedRepo.full_name}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-awesome-app"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used for your workspace identification and deployment subdomain.
                  </p>
                </div>

                {/* Real Branch Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="branchSelect">Production Branch</Label>
                    {branchesData?.defaultBranch && (
                      <span className="text-xs text-muted-foreground">
                        Default: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{branchesData.defaultBranch}</code>
                      </span>
                    )}
                  </div>

                  {branchesLoading ? (
                    <div className="h-10 flex items-center border border-border/50 rounded-md px-3 text-muted-foreground text-sm">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching branches from GitHub...
                    </div>
                  ) : branchesError ? (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{branchesError.message || "Could not fetch branches."}</span>
                    </div>
                  ) : isRepoEmpty ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-500 text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>This repository has no commits or branches. Push code to GitHub before continuing.</span>
                    </div>
                  ) : (
                    <Select value={selectedBranch} onValueChange={(val) => setSelectedBranch(val || "")}>
                      <SelectTrigger id="branchSelect">
                        <SelectValue placeholder="Select an active branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b: GithubBranch) => (
                          <SelectItem key={b.name} value={b.name}>
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono">{b.name}</span>
                              {b.isDefault && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                  default
                                </Badge>
                              )}
                              {b.protected && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                  protected
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Deployments will be automatically created from pushes to this branch.
                  </p>
                </div>

                {/* Framework & Build Settings Preview */}
                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Build & Output Configuration</h4>
                    {frameworkLoading ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Detecting framework...
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs py-0.5 px-2 bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {framework || "Auto-detected"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs py-0.5 px-2 ${
                            deploymentMode === "static"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {deploymentMode === "static" ? "Static Site" : "SSR / Edge"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Compatibility & Mode Warnings */}
                  {warnings.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-500 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Framework Compatibility Notice
                      </div>
                      {warnings.map((w, idx) => (
                        <p key={idx} className="pl-5 text-amber-400/90 leading-relaxed">
                          • {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Root Directory & Monorepo Support */}
                  <div className="space-y-2 rounded-lg border border-border/50 p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rootDirectoryInput" className="text-xs font-medium flex items-center gap-1.5">
                        <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                        Root Directory
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Monorepo / Subdirectory</span>
                    </div>
                    <Input
                      id="rootDirectoryInput"
                      value={rootDirectory}
                      onChange={(e) => setRootDirectory(e.target.value)}
                      placeholder="./ (leave blank for repository root)"
                      className="font-mono text-xs h-9 bg-background/50"
                    />
                    {detectedRoots.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground text-[11px]">Detected workspaces:</span>
                        {detectedRoots.map((rootPath) => (
                          <button
                            key={rootPath}
                            type="button"
                            onClick={() => setRootDirectory(rootPath)}
                            className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[11px] font-mono border border-border/50 transition-colors"
                          >
                            {rootPath}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Build Settings Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Framework Preset</Label>
                      <Input
                        value={framework}
                        onChange={(e) => setFramework(e.target.value)}
                        placeholder="Next.js"
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Package Manager</Label>
                      <Select
                        value={packageManager}
                        onValueChange={(val) => {
                          const pm = val as "npm" | "pnpm" | "yarn" | "bun";
                          setPackageManager(pm);
                          if (pm === "yarn") {
                            setInstallCommand("yarn install");
                            if (buildCommand.startsWith("npm run ")) setBuildCommand(buildCommand.replace("npm run ", "yarn "));
                          } else if (pm === "pnpm") {
                            setInstallCommand("pnpm install");
                            if (buildCommand.startsWith("npm run ")) setBuildCommand(buildCommand.replace("npm run ", "pnpm run "));
                          } else if (pm === "bun") {
                            setInstallCommand("bun install");
                            if (buildCommand.startsWith("npm run ")) setBuildCommand(buildCommand.replace("npm run ", "bun run "));
                          } else {
                            setInstallCommand("npm install");
                            if (buildCommand.startsWith("yarn ") || buildCommand.startsWith("pnpm run ") || buildCommand.startsWith("bun run ")) {
                              setBuildCommand("npm run build");
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Select package manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="npm">npm</SelectItem>
                          <SelectItem value="pnpm">pnpm</SelectItem>
                          <SelectItem value="yarn">yarn</SelectItem>
                          <SelectItem value="bun">bun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Build Command</Label>
                      <Input
                        value={buildCommand}
                        onChange={(e) => setBuildCommand(e.target.value)}
                        placeholder="npm run build"
                        className="font-mono text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Output Directory</Label>
                      <Input
                        value={outputDirectory}
                        onChange={(e) => setOutputDirectory(e.target.value)}
                        placeholder=".next or dist"
                        className="font-mono text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Install Command</Label>
                      <Input
                        value={installCommand}
                        onChange={(e) => setInstallCommand(e.target.value)}
                        placeholder="npm install"
                        className="font-mono text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/10">
                <Button variant="outline" onClick={() => setSelectedRepo(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isDeploying || isRepoEmpty || !projectName || !selectedBranch}
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing Project...
                    </>
                  ) : (
                    "Save & Import Project"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Repository Info Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Repository Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Owner</span>
                  <div className="font-medium flex items-center gap-1.5">
                    {selectedRepo.owner?.avatar_url && (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedRepo.owner.avatar_url} />
                        <AvatarFallback>{selectedRepo.owner.login[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <span>{selectedRepo.owner?.login}</span>
                  </div>
                </div>

                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Visibility</span>
                  <span className="font-medium flex items-center gap-1">
                    {selectedRepo.private ? (
                      <>
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Private
                      </>
                    ) : (
                      <>
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Public
                      </>
                    )}
                  </span>
                </div>

                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium">{selectedRepo.language || "Unknown"}</span>
                </div>

                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">
                    {selectedRepo.updated_at
                      ? formatDistanceToNow(new Date(selectedRepo.updated_at), { addSuffix: true })
                      : "Recently"}
                  </span>
                </div>

                {selectedRepo.html_url && (
                  <div className="pt-2">
                    <a
                      href={selectedRepo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      View repository on GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/30 border-border/40 text-xs text-muted-foreground p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Verified Server Access
              </div>
              <p>
                DeployX securely verifies that your connected GitHub token has access to this repository and branch before saving.
              </p>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // STEP 1: Repository Discovery & Listing
  return (
    <>
      <div className="flex flex-col space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Create a new Project</h2>
          {isConnected && statusData?.username && (
            <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-3 bg-muted/30">
              <GitFork className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Connected as <strong className="font-mono text-foreground">@{statusData.username}</strong></span>
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Import your GitHub repository to configure build settings and deploy to DeployX.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Import Git Repository</CardTitle>
              <CardDescription>
                Select a repository from your personal GitHub account or authorized organizations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/50 rounded-xl space-y-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-secondary/80 flex items-center justify-center border border-border/50">
                    <GitBranch className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h3 className="text-lg font-medium">Connect GitHub</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect your GitHub account to import your repositories and automatically detect build configurations.
                    </p>
                  </div>
                  <Button onClick={handleConnect}>
                    <GitFork className="mr-2 h-4 w-4" /> Connect GitHub
                  </Button>
                </div>
              ) : (
                <>
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search repositories by name or description..."
                        className="pl-8 bg-muted/40 border-border/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      {(["all", "public", "private"] as const).map((filter) => (
                        <Button
                          key={filter}
                          size="sm"
                          variant={visibilityFilter === filter ? "secondary" : "ghost"}
                          className="capitalize text-xs h-9 px-3"
                          onClick={() => {
                            setVisibilityFilter(filter);
                            setCurrentPage(1);
                          }}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Repositories List */}
                  <div className="rounded-lg border border-border/50 bg-muted/10 max-h-[520px] overflow-y-auto divide-y divide-border/40">
                    {reposLoading ? (
                      <div className="flex flex-col items-center justify-center p-12 space-y-2 text-muted-foreground text-sm">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Loading repositories from GitHub...</span>
                      </div>
                    ) : reposError ? (
                      <div className="p-8 text-center text-destructive flex flex-col items-center space-y-3">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="text-sm max-w-sm">{reposError.message || "Failed to load repositories."}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => mutateRepos()}>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                          </Button>
                          <Button variant="secondary" size="sm" onClick={handleConnect}>
                            Reconnect GitHub
                          </Button>
                        </div>
                      </div>
                    ) : filteredRepos.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground space-y-2">
                        <p className="text-sm">
                          {searchQuery
                            ? `No repositories found matching "${searchQuery}".`
                            : "No repositories found for this account."}
                        </p>
                        {searchQuery && (
                          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                            Clear search filter
                          </Button>
                        )}
                      </div>
                    ) : (
                      filteredRepos.map((repo: GithubRepo) => (
                        <div
                          key={repo.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-4"
                        >
                          <div className="flex items-start space-x-3.5 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-secondary/80 flex items-center justify-center shrink-0 border border-border/50 mt-0.5">
                              <GitFork className="h-4 w-4 text-foreground" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm truncate font-mono text-foreground">
                                  {repo.full_name}
                                </span>
                                {repo.private ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 flex items-center gap-1 border-muted-foreground/30">
                                    <Lock className="w-2.5 h-2.5 text-muted-foreground" /> Private
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 flex items-center gap-1 border-muted-foreground/30">
                                    <Globe className="w-2.5 h-2.5 text-muted-foreground" /> Public
                                  </Badge>
                                )}
                              </div>

                              {repo.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                                  {repo.description}
                                </p>
                              )}

                              <div className="flex items-center text-xs text-muted-foreground space-x-4 pt-0.5">
                                {repo.language && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span>{repo.language}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 font-mono">
                                  <GitBranch className="w-3 h-3" />
                                  <span>{repo.default_branch}</span>
                                </div>
                                <span>
                                  {repo.updated_at
                                    ? `Updated ${formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}`
                                    : "Recently"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button size="sm" onClick={() => handleSelectRepo(repo)} className="shrink-0">
                            Import
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {isConnected && (allRepos.length > 0 || currentPage > 1) && (
                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                      <span>Showing page {currentPage}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1 || reposLoading}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasMore || reposLoading}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Templates Sidebar */}
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Deploy from Template</CardTitle>
              <CardDescription>
                Quickly spin up a starter project with pre-configured settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Next.js App", desc: "App router with Tailwind CSS" },
                { name: "React + Vite", desc: "Lightning-fast client SPA" },
                { name: "Vue 3", desc: "Single-page application" },
                { name: "Static HTML", desc: "Simple HTML, CSS, and JS" },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 cursor-pointer transition-colors bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                      <Box className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function NewProjectPage() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 max-w-5xl mx-auto w-full">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <NewProjectForm />
      </Suspense>
    </div>
  );
}
