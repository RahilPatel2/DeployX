"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  KeyRound,
  Copy,
  Check,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ApiKeyItem {
  _id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ApiSettingsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expirationDays, setExpirationDays] = useState<number>(90);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Newly generated key modal
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [createdKeyName, setCreatedKeyName] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Revocation state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ keys: ApiKeyItem[] }>(
    "/api/auth/api-keys",
    fetcher
  );
  const keys = data?.keys || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keyName.trim();
    if (!clean) {
      toast.error("Please provide a name for this API key");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clean,
          expirationDays: Number(expirationDays),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to generate key");
      }

      setIsCreateOpen(false);
      setKeyName("");
      setCreatedKeyName(resData.key.name);
      setCreatedRawKey(resData.rawKey);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error generating API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyNewKey = async () => {
    if (!createdRawKey) return;
    try {
      await navigator.clipboard.writeText(createdRawKey);
      setCopiedKey(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error("Failed to copy key");
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      setIsRevoking(true);
      const res = await fetch(`/api/auth/api-keys?id=${keyToRevoke._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Failed to revoke key");
      }

      toast.success(`API key "${keyToRevoke.name}" revoked`);
      setKeyToRevoke(null);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error revoking API key");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage your API keys for programmatic access, CLI tooling, and CI/CD pipelines.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="active:scale-95 transition-transform">
          <Plus className="mr-2 h-4 w-4" />
          Create New Key
        </Button>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center justify-between">
            <span>Active Keys</span>
            <span className="text-xs text-muted-foreground font-mono font-normal">
              {keys.length} key{keys.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
          <CardDescription>
            Active credentials authorized to perform deployments and API actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && !data ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border/50 rounded-lg text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground mb-3" />
              <h4 className="font-semibold text-sm">No API Keys Generated</h4>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                You haven&apos;t created any API keys yet. Create an API key to authenticate GitHub Actions, DeployX CLI, or custom scripts.
              </p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate Key
              </Button>
            </div>
          ) : (
            keys.map((k) => (
              <div
                key={k._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/30 transition-all gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <KeyRound className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-sm text-foreground">{k.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
                      <span>{k.prefix}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                      {k.expiresAt && (
                        <>
                          <span>•</span>
                          <span>Expires {new Date(k.expiresAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setKeyToRevoke(k)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Create API Key
              </DialogTitle>
              <DialogDescription>
                Generate an authentication token for CLI commands or automated deployment workflows.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Key Name / Description</label>
                <Input
                  type="text"
                  placeholder="e.g. GitHub Actions CI/CD"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Expiration</label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={365}>1 Year</option>
                  <option value={0}>Never Expire</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !keyName.trim()}>
                {isSubmitting ? "Generating..." : "Generate Key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Display Newly Created Key Dialog */}
      <Dialog
        open={Boolean(createdRawKey)}
        onOpenChange={(open) => !open && setCreatedRawKey(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <Check className="h-5 w-5" /> API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your secret key now. For your security, this key cannot be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 bg-muted/60 border border-border/50 rounded-lg space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground">
                Key: {createdKeyName}
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-xs break-all bg-background p-2 rounded border border-border/40 select-all">
                <span>{createdRawKey}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={handleCopyNewKey}
                  title="Copy secret key"
                >
                  {copiedKey ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Store this key securely in your secret manager or environment variables. DeployX cannot retrieve it once closed.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setCreatedRawKey(null);
                setCreatedKeyName("");
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Dialog */}
      <Dialog
        open={Boolean(keyToRevoke)}
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Revoke API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke <strong className="text-foreground">{keyToRevoke?.name}</strong>? Any automated workflows or CLI processes using this key will immediately stop working.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setKeyToRevoke(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
