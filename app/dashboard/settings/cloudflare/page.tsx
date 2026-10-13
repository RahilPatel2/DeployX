"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Server,
  Layers,
  ExternalLink,
  Loader2,
} from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch status");
  }
  return data;
};

export default function CloudflareSettingsPage() {
  const { data, error, isLoading, mutate, isValidating } = useSWR(
    "/api/integrations/cloudflare/status",
    fetcher
  );

  const handleTestConnection = async () => {
    try {
      const refreshed = await mutate();
      if (refreshed?.connected) {
        toast.success("Cloudflare connection verified successfully!");
      } else {
        toast.error(refreshed?.error || "Cloudflare configuration check failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error verifying connection";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Cloudflare Provider Integration</h3>
          <p className="text-sm text-muted-foreground">
            Manage your Cloudflare deployment credentials and inspect provider capabilities.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isLoading || isValidating}
          className="flex items-center gap-1.5 self-start"
        >
          {isValidating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span>Test Connection</span>
        </Button>
      </div>

      {/* Main Connection Status Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Connection Status</CardTitle>
            </div>
            {isLoading ? (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Checking...
              </Badge>
            ) : data?.connected ? (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected & Verified
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Configuration Problem
              </Badge>
            )}
          </div>
          <CardDescription>
            Live connectivity evaluation with official Cloudflare API endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Verifying Cloudflare credentials...
            </div>
          ) : error ? (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          ) : (
            <>
              {data?.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{data.error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
                  <span className="text-xs text-muted-foreground block mb-1">Account Name</span>
                  <span className="font-medium text-foreground">{data?.accountName || "N/A"}</span>
                </div>

                <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
                  <span className="text-xs text-muted-foreground block mb-1">Account ID</span>
                  <span className="font-mono text-xs text-foreground">
                    {data?.accountId ? `${data.accountId.slice(0, 8)}...${data.accountId.slice(-8)}` : "Not Configured"}
                  </span>
                </div>

                <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
                  <span className="text-xs text-muted-foreground block mb-1">API Token Status</span>
                  <div className="flex items-center gap-1.5">
                    {data?.tokenStatus === "active" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-medium capitalize">{data?.tokenStatus || "Unknown"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
                  <span className="text-xs text-muted-foreground block mb-1">Last Diagnostic Check</span>
                  <span className="text-xs text-muted-foreground">
                    {data?.checkedAt
                      ? formatDistanceToNow(new Date(data.checkedAt), { addSuffix: true })
                      : "Just now"}
                  </span>
                </div>
              </div>

              {/* Granted Permissions */}
              <div className="pt-2">
                <span className="text-xs font-medium text-muted-foreground block mb-2">Verified Token Permissions</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={data?.permissions?.pages ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground"}
                  >
                    Cloudflare Pages: {data?.permissions?.pages ? "Granted" : "Missing"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={data?.permissions?.workers ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground"}
                  >
                    Cloudflare Workers: {data?.permissions?.workers ? "Available" : "Optional"}
                  </Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-3 bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Server-only credential isolation. Tokens are never exposed to browser clients.</span>
          </div>
          <a
            href="https://dash.cloudflare.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1 font-medium text-primary"
          >
            Cloudflare Dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </CardFooter>
      </Card>

      {/* Deployment Targets Overview */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Supported Deployment Targets</CardTitle>
          </div>
          <CardDescription>
            DeployX maps projects to appropriate Cloudflare runtime targets based on framework analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-border/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1.5">
                <Server className="h-4 w-4 text-emerald-500" />
                Cloudflare Pages (Static)
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                Primary Target
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Global edge hosting for static Jamstack sites, Vite applications, Next.js static exports, Astro, Nuxt static builds, and HTML/CSS/JS.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-blue-500" />
                Cloudflare Pages Functions
              </span>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                Adapter Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full-stack edge rendering for Next.js (via <code>@cloudflare/next-on-pages</code>), SvelteKit, and Nuxt edge presets. Unadapted SSR builds are rejected safely.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
