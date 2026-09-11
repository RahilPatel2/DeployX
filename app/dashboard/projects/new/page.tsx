import { auth } from "@/auth";
import { getUserRepositories } from "@/lib/github/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Globe, Search, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createProjectAction } from "./actions";

export default async function NewProjectPage() {
  const session = await auth();
  
  // @ts-expect-error We added accessToken in auth.ts
  const accessToken = session?.accessToken as string;

  if (!accessToken) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-500">Error: Not connected to GitHub</h1>
        <p>Please log out and log back in to grant GitHub access.</p>
      </div>
    );
  }

  const repositories = await getUserRepositories(accessToken);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Create a new Project</h2>
        <p className="text-muted-foreground">
          Import your GitHub repository to deploy it automatically.
        </p>
      </div>

      <Card>
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
              className="pl-8"
              // In a real app we'd use client-side filtering here
            />
          </div>

          <div className="rounded-md border max-h-[500px] overflow-y-auto">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={repo.owner.avatar_url}
                    alt={repo.owner.login}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">{repo.full_name}</span>
                      {repo.private ? (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Globe className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground space-x-4 mt-1">
                      {repo.language && (
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                          {repo.language}
                        </div>
                      )}
                      <div className="flex items-center">
                        <GitBranch className="w-3 h-3 mr-1" />
                        {repo.default_branch}
                      </div>
                      <span>
                        Updated {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <form action={createProjectAction}>
                  <input type="hidden" name="repoId" value={repo.id} />
                  <input type="hidden" name="repoName" value={repo.name} />
                  <input type="hidden" name="repoFullName" value={repo.full_name} />
                  <input type="hidden" name="repoOwner" value={repo.owner.login} />
                  <input type="hidden" name="defaultBranch" value={repo.default_branch} />
                  <input type="hidden" name="language" value={repo.language || ""} />
                  <Button type="submit" size="sm">
                    Import
                  </Button>
                </form>
              </div>
            ))}
            
            {repositories.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No repositories found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
