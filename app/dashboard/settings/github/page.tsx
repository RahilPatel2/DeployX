"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GitFork,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Link2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface GithubStatusResponse {
  connected: boolean;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  connectedAt: string | null;
  scopes: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function GithubSettingsContent() {
  const searchParams = useSearchParams();
  const { data, isLoading, mutate } = useSWR<GithubStatusResponse>("/api/integrations/github/status", fetcher);
  const [disconnecting, setDisconnecting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Surface status alerts from OAuth redirection
  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get("success");

    if (error) {
      toast.error(error);
    }
    if (success) {
      toast.success(success);
      mutate();
    }
  }, [searchParams, mutate]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/github/status", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect GitHub");
      toast.success("GitHub disconnected successfully.");
      setDialogOpen(false);
      mutate();
    } catch {
      toast.error("Failed to disconnect GitHub. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = data?.connected;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">GitHub Integration</h3>
        <p className="text-sm text-muted-foreground">
          Manage your connected GitHub account, OAuth scopes, and repository access.
        </p>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Account</CardTitle>
              <CardDescription className="mt-1">
                DeployX uses this connection to import your repositories and trigger automated deployments.
              </CardDescription>
            </div>
            {isConnected && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 flex items-center gap-1.5 py-1 px-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-border/50">
                    <AvatarImage src={data?.avatarUrl || undefined} alt={data?.username || "GitHub Avatar"} />
                    <AvatarFallback className="bg-secondary">
                      <GitFork className="h-6 w-6 text-foreground" />
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="font-semibold text-base flex items-center gap-2">
                      {data?.name || data?.username || "Connected Account"}
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    {data?.username && (
                      <div className="text-sm text-muted-foreground font-mono">
                        @{data.username}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {data?.connectedAt
                        ? `Connected ${formatDistanceToNow(new Date(data.connectedAt), { addSuffix: true })}`
                        : "Active"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {data?.profileUrl && (
                    <a
                      href={data.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      View on GitHub <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </a>
                  )}
                  <a
                    href="/api/integrations/github/connect?returnTo=/dashboard/settings/github"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Reconnect
                  </a>
                </div>
              </div>

              {/* Scope details */}
              <div className="rounded-lg border border-border/40 p-4 bg-muted/10 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Granted Permissions & Scopes
                </div>
                <p className="text-xs text-muted-foreground">
                  DeployX has been granted minimal permissions to read your identity and repositories for deployment analysis.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(data?.scopes && data.scopes.length > 0 ? data.scopes : ["read:user", "repo"]).map((scope) => (
                    <Badge key={scope} variant="secondary" className="font-mono text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed border-border/60 rounded-xl space-y-4">
              <div className="h-12 w-12 rounded-full bg-secondary/80 flex items-center justify-center border border-border/50">
                <Link2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="font-medium text-foreground">No GitHub Account Connected</h4>
                <p className="text-sm text-muted-foreground">
                  Connect your GitHub account to import repositories, automatically detect frameworks, and trigger builds on push.
                </p>
              </div>
              <a
                href="/api/integrations/github/connect?returnTo=/dashboard/settings/github"
                className={buttonVariants({ variant: "default", size: "default" })}
              >
                <GitFork className="mr-2 h-4 w-4" />
                Connect GitHub
              </a>
            </div>
          )}
        </CardContent>

        {isConnected && (
          <CardFooter className="border-t border-border/50 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/10">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Access tokens are encrypted at rest with AES-256-GCM and never exposed to the browser.</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger className={buttonVariants({ variant: "destructive", size: "sm" })}>
                Disconnect
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Disconnect GitHub Account
                  </DialogTitle>
                  <DialogDescription className="pt-2">
                    Are you sure you want to disconnect <span className="font-semibold text-foreground">@{data?.username}</span>?
                    This will remove stored credentials on DeployX and prevent automatic repository importing until reconnected.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={disconnecting}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm Disconnect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function GithubSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <GithubSettingsContent />
    </Suspense>
  );
}
