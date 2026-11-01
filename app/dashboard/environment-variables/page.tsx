"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Key,
  Search,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Check,
  FolderGit2,
} from "lucide-react";
import { toast } from "sonner";

interface ProjectItem {
  _id: string;
  name: string;
  slug: string;
}

interface EnvVarItem {
  _id: string;
  key: string;
  value: string;
  targetEnvironments: string[];
  projectId: ProjectItem | string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EnvVarsPage() {
  const [search, setSearch] = useState("");
  const [selectedFilterProject, setSelectedFilterProject] = useState("all");
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newEnvironments, setNewEnvironments] = useState<string[]>([
    "production",
    "preview",
    "development",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [varToDelete, setVarToDelete] = useState<EnvVarItem | null>(null);

  const { data: projectsData } = useSWR<{ projects: ProjectItem[] }>(
    "/api/projects?limit=100",
    fetcher
  );
  const projects = projectsData?.projects || [];

  const envsUrl =
    selectedFilterProject === "all"
      ? "/api/env"
      : `/api/env?projectId=${selectedFilterProject}`;

  const { data, isLoading, mutate } = useSWR<{ variables: EnvVarItem[] }>(envsUrl, fetcher);
  const variables = data?.variables || [];

  const toggleShow = (id: string) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      toast.success("Value copied to clipboard");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const toggleEnvCheckbox = (env: string) => {
    setNewEnvironments((prev) =>
      prev.includes(env) ? prev.filter((e) => e !== env) : [...prev, env]
    );
  };

  const handleAddVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKey.trim();
    if (!cleanKey) {
      toast.error("Please provide a variable key");
      return;
    }
    if (!newProjectId) {
      toast.error("Please select a target project");
      return;
    }
    if (newEnvironments.length === 0) {
      toast.error("Please select at least one environment");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: cleanKey,
          value: newValue,
          projectId: newProjectId,
          targetEnvironments: newEnvironments,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to add variable");
      }

      toast.success(`Variable ${cleanKey} saved`);
      setIsAddOpen(false);
      setNewKey("");
      setNewValue("");
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save variable");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVariable = async () => {
    if (!varToDelete) return;
    try {
      setDeletingId(varToDelete._id);
      const res = await fetch(`/api/env?id=${varToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Failed to delete variable");
      }

      toast.success(`Variable ${varToDelete.key} deleted`);
      setVarToDelete(null);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete variable");
    } finally {
      setDeletingId(null);
    }
  };

  const cleanSearch = search.toLowerCase().trim();
  const filteredVariables = variables.filter((v) => {
    const projName = typeof v.projectId === "object" ? v.projectId.name : "";
    return (
      !cleanSearch ||
      v.key.toLowerCase().includes(cleanSearch) ||
      projName.toLowerCase().includes(cleanSearch)
    );
  });

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Environment Variables
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage encrypted secrets and environment configuration across all projects.
          </p>
        </div>
        <Button
          onClick={() => {
            if (projects.length > 0 && !newProjectId) {
              setNewProjectId(projects[0]._id);
            }
            setIsAddOpen(true);
          }}
          className="active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Variable
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search environment variables..."
            className="pl-8 bg-muted/50 border-border/50 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={selectedFilterProject}
          onChange={(e) => setSelectedFilterProject(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-xs font-sans focus:outline-none focus:ring-1 focus:ring-ring sm:w-56"
          aria-label="Filter variables by project"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {isLoading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur border-border/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredVariables.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/50 rounded-xl bg-card/20 backdrop-blur">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No environment variables found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6 text-xs sm:text-sm">
              {search
                ? `No environment variables match "${search}".`
                : "No variables configured. Add secrets, API tokens, and database connection strings to be injected into your deployments."}
            </p>
            <Button
              onClick={() => {
                if (projects.length > 0 && !newProjectId) {
                  setNewProjectId(projects[0]._id);
                }
                setIsAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Variable
            </Button>
          </div>
        ) : (
          filteredVariables.map((envVar) => {
            const isRevealed = Boolean(showValues[envVar._id]);
            const projName =
              typeof envVar.projectId === "object"
                ? envVar.projectId?.name || "Global"
                : "Project";

            return (
              <Card
                key={envVar._id}
                className="bg-card/50 backdrop-blur border-border/50 hover:border-border/80 transition-all"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-9 w-9 rounded-md bg-secondary/50 border border-border flex items-center justify-center shrink-0 mt-0.5">
                      <Key className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {envVar.key}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal font-sans">
                          <FolderGit2 className="h-2.5 w-2.5 mr-1" />
                          {projName}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded border border-border/40 flex items-center gap-2">
                          <span>
                            {isRevealed
                              ? envVar.value || "(empty)"
                              : "••••••••••••••••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleShow(envVar._id)}
                            className="hover:text-foreground text-muted-foreground/70"
                            title={isRevealed ? "Hide value" : "Reveal value"}
                            aria-label={isRevealed ? "Hide value" : "Reveal value"}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyToClipboard(envVar._id, envVar.value)}
                          title="Copy value"
                        >
                          {copiedKey === envVar._id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {envVar.targetEnvironments?.map((env: string) => (
                          <Badge
                            key={env}
                            variant="secondary"
                            className="text-[10px] capitalize px-1.5 py-0"
                          >
                            {env}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setVarToDelete(envVar)}
                      title="Delete variable"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Variable Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddVariable}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" /> Add Environment Variable
              </DialogTitle>
              <DialogDescription>
                Define a key-value secret or configuration to inject during project build and runtime.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Target Project</label>
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No projects available. Create a project first.
                  </p>
                ) : (
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  >
                    <option value="" disabled>
                      Select project...
                    </option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.slug})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Variable Key</label>
                <Input
                  type="text"
                  placeholder="e.g. DATABASE_URL or NEXT_PUBLIC_API_KEY"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="font-mono text-xs uppercase"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Variable Value</label>
                <Input
                  type="text"
                  placeholder="Secret or value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Environments</label>
                <div className="flex items-center gap-4 text-xs">
                  {["production", "preview", "development"].map((env) => (
                    <label key={env} className="flex items-center gap-1.5 cursor-pointer capitalize">
                      <input
                        type="checkbox"
                        checked={newEnvironments.includes(env)}
                        onChange={() => toggleEnvCheckbox(env)}
                        className="rounded border-border"
                      />
                      {env}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !newKey || !newProjectId}>
                {isSubmitting ? "Saving..." : "Save Variable"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(varToDelete)}
        onOpenChange={(open) => !open && setVarToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Variable
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete variable{" "}
              <strong className="text-foreground font-mono">{varToDelete?.key}</strong>? This secret will no longer be available in subsequent builds.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVarToDelete(null)}
              disabled={Boolean(deletingId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteVariable}
              disabled={Boolean(deletingId)}
            >
              {deletingId ? "Deleting..." : "Delete Variable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
