"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Search, Lock, Globe, GitBranch, GitFork, Box, Loader2, ArrowLeft, Settings2 } from "lucide-react";
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

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [projectName, setProjectName] = useState("");
  const [framework, setFramework] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(error);
    }
  }, [searchParams]);

  const { data: statusData, isLoading: statusLoading } = useSWR("/api/integrations/github/status", fetcher);
  const isConnected = statusData?.connected;

  const { data: reposData, error: reposError, isLoading: reposLoading } = useSWR(
    isConnected ? "/api/integrations/github/repos" : null,
    fetcher
  );
  
  const allRepos = reposData?.repos || [];
  const repos = allRepos.filter((r: any) => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  const { data: branchesData, isLoading: branchesLoading } = useSWR(
    selectedRepo ? `/api/integrations/github/branches?repo=${selectedRepo.full_name}` : null,
    fetcher
  );

  const { data: frameworkData, isLoading: frameworkLoading } = useSWR(
    selectedRepo && selectedBranch ? `/api/integrations/github/framework?repo=${selectedRepo.full_name}&branch=${selectedBranch}` : null,
    fetcher
  );

  useEffect(() => {
    if (frameworkData) {
      setFramework(frameworkData.framework);
      setBuildCommand(frameworkData.buildCommand);
      setOutputDirectory(frameworkData.outputDirectory);
      setInstallCommand(frameworkData.installCommand);
    }
  }, [frameworkData]);

  const handleSelectRepo = (repo: any) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setProjectName(repo.name);
  };

  const handleDeploy = async () => {
    if (!projectName || !selectedBranch || !framework) {
       toast.error("Please fill all required fields");
       return;
    }
    
    setIsDeploying(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          repository: selectedRepo.full_name,
          branch: selectedBranch,
          framework,
          buildCommand,
          outputDirectory,
          installCommand,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }

      const data = await res.json();
      toast.success("Project imported and deploying");
      router.push(`/dashboard/projects/${data.project._id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred while importing the project");
      setIsDeploying(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/integrations/github/connect";
  };

  if (selectedRepo) {
    return (
      <>
        <div className="flex flex-col space-y-2 mb-6">
           <Button variant="ghost" size="sm" className="w-fit mb-2 text-muted-foreground" onClick={() => setSelectedRepo(null)}>
             <ArrowLeft className="h-4 w-4 mr-2" /> Back to Repositories
           </Button>
          <h2 className="text-3xl font-bold tracking-tight">Configure Project</h2>
          <p className="text-muted-foreground">
            Review your deployment configuration. We've auto-detected optimal settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                   <Settings2 className="h-5 w-5" /> Project Settings
                </CardTitle>
                <CardDescription>
                  Deploying <span className="font-semibold text-foreground">{selectedRepo.full_name}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
                
                <div className="space-y-2">
                   <Label>Production Branch</Label>
                   {branchesLoading ? (
                     <div className="h-10 flex items-center border border-border/50 rounded-md px-3 text-muted-foreground text-sm">
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching branches...
                     </div>
                   ) : (
                     <Select value={selectedBranch} onValueChange={(val) => setSelectedBranch(val || "")}>
                       <SelectTrigger>
                         <SelectValue placeholder="Select a branch" />
                       </SelectTrigger>
                       <SelectContent>
                         {branchesData?.branches?.map((b: any) => (
                           <SelectItem key={b.name} value={b.name}>
                             {b.name} {b.name === selectedRepo.default_branch ? "(default)" : ""}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   )}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium mb-4 flex items-center justify-between">
                    Build Settings
                    {frameworkLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </h4>
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <Label>Framework</Label>
                        <Input value={framework} onChange={(e) => setFramework(e.target.value)} disabled={frameworkLoading} />
                     </div>
                     <div className="space-y-2">
                        <Label>Build Command</Label>
                        <Input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} placeholder="e.g. npm run build" disabled={frameworkLoading} />
                     </div>
                     <div className="space-y-2">
                        <Label>Output Directory</Label>
                        <Input value={outputDirectory} onChange={(e) => setOutputDirectory(e.target.value)} placeholder="e.g. out, dist, build" disabled={frameworkLoading} />
                     </div>
                     <div className="space-y-2">
                        <Label>Install Command</Label>
                        <Input value={installCommand} onChange={(e) => setInstallCommand(e.target.value)} placeholder="e.g. npm install" disabled={frameworkLoading} />
                     </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/50 px-6 py-4">
                <Button onClick={handleDeploy} disabled={isDeploying || frameworkLoading || branchesLoading} className="w-full md:w-auto">
                  {isDeploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Deploy Project
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Repository Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium">{selectedRepo.owner?.login}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Visibility</span>
                  <span className="font-medium flex items-center gap-1">
                    {selectedRepo.private ? <><Lock className="h-3 w-3"/> Private</> : <><Globe className="h-3 w-3"/> Public</>}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium">{selectedRepo.language || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{formatDistanceToNow(new Date(selectedRepo.updated_at), { addSuffix: true })}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-2 mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Create a new Project</h2>
        <p className="text-muted-foreground">
          Import your GitHub repository to deploy it automatically to our global edge network.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Import Git Repository</CardTitle>
              <CardDescription>
                Select a repository from your personal account or organizations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/50 rounded-lg">
                  <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Connect GitHub</h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                    Connect your GitHub account to import repositories and set up automatic deployments.
                  </p>
                  <Button onClick={handleConnect}>
                    <GitBranch className="mr-2 h-4 w-4" /> Connect GitHub
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search repositories..."
                      className="pl-8 bg-muted/50 border-border/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/20 max-h-[500px] overflow-y-auto">
                    {reposLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : reposError ? (
                      <div className="p-8 text-center text-destructive flex flex-col items-center">
                        <p className="mb-4">Failed to load repositories: {reposError.message}</p>
                        <Button variant="outline" onClick={handleConnect}>Reconnect GitHub</Button>
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No repositories found matching your search.
                      </div>
                    ) : (
                      repos.map((repo: any) => (
                        <div
                          key={repo.id}
                          className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                              <GitFork className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-sm">{repo.full_name}</span>
                                {repo.private ? (
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <Globe className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground space-x-4 mt-1">
                                {repo.language && (
                                  <div className="flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                                    {repo.language}
                                  </div>
                                )}
                                <div className="flex items-center">
                                  <GitBranch className="w-3 h-3 mr-1" />
                                  {repo.default_branch}
                                </div>
                                <span>
                                  {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => handleSelectRepo(repo)}
                          >
                            Import
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Clone Template</CardTitle>
              <CardDescription>
                Start from a pre-configured template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['Next.js', 'React', 'Vue', 'Nuxt'].map((t) => (
                <div key={t} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                      <Box className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm">{t}</span>
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
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <Suspense fallback={<div>Loading...</div>}>
        <NewProjectForm />
      </Suspense>
    </div>
  );
}
