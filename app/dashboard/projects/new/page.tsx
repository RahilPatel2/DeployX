"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Lock, Globe, GitBranch, GitFork, Box, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch");
  return data;
};

import { Suspense } from "react";

function NewProjectForm() {
  const [importingId, setImportingId] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const repos = reposData?.repos || [];

  const handleImport = async (repo: any) => {
    setImportingId(repo.id);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: repo.name,
          repository: repo.full_name,
          branch: repo.default_branch,
          framework: "Next.js", // We auto-detect this in a real system
          buildCommand: "npm run build",
          outputDirectory: ".next",
          installCommand: "npm install",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const data = await res.json();
      toast.success("Project imported successfully");
      router.push(`/dashboard/projects/${data.project._id}`);
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while importing the project");
      setImportingId(null);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/integrations/github/connect";
  };

  return (
    <>
      <div className="flex flex-col space-y-2">
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
                    />
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/20">
                    {reposLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : reposError ? (
                      <div className="p-8 text-center text-destructive flex flex-col items-center">
                        <p className="mb-4">Failed to load repositories: {reposError.message}</p>
                        <Button variant="outline" onClick={handleConnect}>Reconnect GitHub</Button>
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No repositories found.
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
                            onClick={() => handleImport(repo)}
                            disabled={importingId !== null}
                          >
                            {importingId === repo.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              "Import"
                            )}
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
