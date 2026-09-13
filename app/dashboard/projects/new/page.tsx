"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Lock, Globe, GitBranch, GitFork, Box, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const mockRepos = [
  { id: 1, full_name: "RahilPatel2/portfolio", name: "portfolio", private: false, language: "TypeScript", default_branch: "main", updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: 2, full_name: "RahilPatel2/deployx", name: "deployx", private: true, language: "TypeScript", default_branch: "main", updated_at: new Date(Date.now() - 1000 * 60 * 5) },
  { id: 3, full_name: "RahilPatel2/docs", name: "docs", private: false, language: "MDX", default_branch: "master", updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) },
];

export default function NewProjectPage() {
  const [importingId, setImportingId] = useState<number | null>(null);
  const router = useRouter();

  const handleImport = async (repo: typeof mockRepos[0]) => {
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

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
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
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search repositories..."
                  className="pl-8 bg-muted/50 border-border/50"
                />
              </div>

              <div className="rounded-md border border-border/50 bg-muted/20">
                {mockRepos.map((repo) => (
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
                            {formatDistanceToNow(repo.updated_at, { addSuffix: true })}
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
                ))}
              </div>
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
    </div>
  );
}
