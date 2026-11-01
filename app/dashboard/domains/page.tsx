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
  Globe,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Server,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface DomainItem {
  _id: string;
  domain: string;
  status: "active" | "pending" | "error";
  projectId?: string;
  createdAt: string;
}

interface ProjectItem {
  _id: string;
  name: string;
  slug: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DomainsPage() {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDomainForDns, setSelectedDomainForDns] = useState<DomainItem | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<DomainItem | null>(null);

  // Form states
  const [newDomainName, setNewDomainName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ domains: DomainItem[] }>("/api/domains", fetcher);
  const { data: projectsData } = useSWR<{ projects: ProjectItem[] }>("/api/projects?limit=100", fetcher);

  const domains = data?.domains || [];
  const projects = projectsData?.projects || [];

  const filteredDomains = domains.filter((d) =>
    d.domain.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = newDomainName.trim().toLowerCase();
    if (!cleanDomain) {
      toast.error("Please enter a domain name");
      return;
    }
    if (!selectedProjectId) {
      toast.error("Please select a project to connect");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: cleanDomain,
          projectId: selectedProjectId,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to add domain");
      }

      toast.success(`Domain ${cleanDomain} added successfully!`);
      setIsAddOpen(false);
      setNewDomainName("");
      setSelectedProjectId("");
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyDns = async (domain: DomainItem) => {
    try {
      setVerifyingId(domain._id);
      const res = await fetch("/api/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: domain._id, action: "verify" }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Verification failed");
      }

      toast.success(`Domain ${domain.domain} verified and SSL active!`);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to verify domain");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/domains?id=${domainToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Failed to delete domain");
      }

      toast.success(`Domain ${domainToDelete.domain} removed`);
      setDomainToDelete(null);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete domain");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedTarget(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Domains</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage custom domains and SSL certificates across all your projects.
          </p>
        </div>
        <Button
          onClick={() => {
            if (projects.length > 0 && !selectedProjectId) {
              setSelectedProjectId(projects[0]._id);
            }
            setIsAddOpen(true);
          }}
          className="active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Domain
        </Button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search domains..."
          className="pl-8 bg-muted/50 border-border/50 max-w-sm text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {isLoading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur border-border/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/50 rounded-xl bg-card/20 backdrop-blur">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No domains found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6 text-sm">
              {search
                ? `No custom domains match "${search}".`
                : "You haven't added any custom domains yet. Connect your domain to direct traffic to your DeployX deployment."}
            </p>
            <Button
              onClick={() => {
                if (projects.length > 0 && !selectedProjectId) {
                  setSelectedProjectId(projects[0]._id);
                }
                setIsAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Domain
            </Button>
          </div>
        ) : (
          filteredDomains.map((domain) => {
            const project = projects.find((p) => p._id === domain.projectId);
            const isVerifying = verifyingId === domain._id;

            return (
              <Card
                key={domain._id}
                className="bg-card/50 backdrop-blur border-border/50 hover:border-border/80 transition-all"
              >
                <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base sm:text-lg tracking-tight">
                          {domain.domain}
                        </span>
                        {domain.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" /> Pending DNS
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {project ? (
                          <span>
                            Linked to: <strong className="text-foreground">{project.name}</strong>
                          </span>
                        ) : (
                          <span>Global deployment</span>
                        )}
                        <span>•</span>
                        <span>Added {new Date(domain.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-mono"
                      onClick={() => setSelectedDomainForDns(domain)}
                    >
                      <Server className="h-3.5 w-3.5 mr-1" /> DNS Records
                    </Button>

                    {domain.status !== "active" && (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isVerifying}
                        className="h-8 text-xs font-mono"
                        onClick={() => handleVerifyDns(domain)}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 mr-1 ${isVerifying ? "animate-spin" : ""}`}
                        />
                        {isVerifying ? "Checking..." : "Verify DNS"}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDomainToDelete(domain)}
                      title="Delete domain"
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

      {/* Add Domain Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddDomain}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Add Custom Domain
              </DialogTitle>
              <DialogDescription>
                Connect a custom domain or subdomain to direct web traffic to your project.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Target Project</label>
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No projects found. Please create a project first.
                  </p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-sans focus:outline-none focus:ring-1 focus:ring-ring"
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
                <label className="text-xs font-medium text-foreground">Domain Name</label>
                <Input
                  type="text"
                  placeholder="e.g. app.mycompany.com or mysite.dev"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter apex domain or subdomain without protocol prefix (no https://).
                </p>
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
              <Button type="submit" disabled={isSubmitting || !newDomainName || !selectedProjectId}>
                {isSubmitting ? "Adding..." : "Add Domain"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DNS Configuration Instructions Dialog */}
      <Dialog
        open={Boolean(selectedDomainForDns)}
        onOpenChange={(open) => !open && setSelectedDomainForDns(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" /> DNS Configuration
            </DialogTitle>
            <DialogDescription>
              Add the following record in your DNS provider (Cloudflare, GoDaddy, Namecheap, Route 53, etc.)
            </DialogDescription>
          </DialogHeader>

          {selectedDomainForDns && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50 text-xs space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Record Type</span>
                  <strong className="text-foreground font-mono">CNAME</strong>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Name / Host</span>
                  <strong className="text-foreground font-mono">
                    {selectedDomainForDns.domain.includes(".")
                      ? selectedDomainForDns.domain.split(".")[0] === "www"
                        ? "www"
                        : "@"
                      : "@"}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Target / Value</span>
                  <div className="flex items-center gap-1.5 font-mono text-foreground font-semibold">
                    <span>cname.deployx.app</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard("cname.deployx.app")}
                      title="Copy DNS target"
                    >
                      {copiedTarget ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>TTL</span>
                  <strong className="text-foreground font-mono">Automatic / 3600</strong>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>• DNS changes propagate globally within a few minutes up to 24 hours.</p>
                <p>• SSL / TLS certificates are provisioned automatically upon DNS resolution.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedDomainForDns(null)}
            >
              Close
            </Button>
            {selectedDomainForDns && selectedDomainForDns.status !== "active" && (
              <Button
                type="button"
                onClick={() => {
                  handleVerifyDns(selectedDomainForDns);
                  setSelectedDomainForDns(null);
                }}
              >
                Verify Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Domain Confirmation Dialog */}
      <Dialog
        open={Boolean(domainToDelete)}
        onOpenChange={(open) => !open && setDomainToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Remove Custom Domain
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{" "}
              <strong className="text-foreground">{domainToDelete?.domain}</strong>? Traffic to this domain will no longer be routed to DeployX.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDomainToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteDomain}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
