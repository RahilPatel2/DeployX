"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GitFork,
  GitBranch,
  ExternalLink,
  ArrowUpRight,
  Loader2,
  FolderTree,
  Settings2,
  Copy,
  Eye,
  EyeOff,
  Radio,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { DeploymentActivityChart } from "@/components/dashboard/deployment-chart";
import { RecentDeploymentsTable } from "@/components/dashboard/recent-deployments";
import { use, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ProjectData {
  _id: string;
  name: string;
  slug: string;
  repository: string;
  branch: string;
  framework: string;
  packageManager?: string;
  rootDirectory?: string;
  deploymentMode?: "static" | "ssr";
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  productionUrl?: string;
  autoDeploy?: boolean;
  webhookStatus?: "active" | "inactive" | "manual" | "failed";
  lastWebhookPayloadAt?: string;
  lastWebhookDeliveryId?: string;
  lastWebhookStatus?: "success" | "failed" | "ignored";
  lastWebhookError?: string;
  updatedAt?: string;
}

function ProjectSettingsTab({
  project,
  onSaved,
}: {
  project: ProjectData;
  onSaved: () => void;
}) {
  const [buildCommand, setBuildCommand] = useState(project.buildCommand || "");
  const [outputDirectory, setOutputDirectory] = useState(project.outputDirectory || "");
  const [installCommand, setInstallCommand] = useState(project.installCommand || "npm install");
  const [rootDirectory, setRootDirectory] = useState(project.rootDirectory || "");
  const [packageManager, setPackageManager] = useState(project.packageManager || "npm");
  const [deploymentMode, setDeploymentMode] = useState(project.deploymentMode || "static");
  const [branch, setBranch] = useState(project.branch || "main");
  const [autoDeploy, setAutoDeploy] = useState(project.autoDeploy ?? true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingGit, setIsSavingGit] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const { data: webhookData, mutate: mutateWebhook } = useSWR(
    `/api/projects/${project._id}/webhook`,
    fetcher
  );

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildCommand,
          outputDirectory,
          installCommand,
          rootDirectory,
          packageManager,
          deploymentMode,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update project settings");
      }

      toast.success("Build configuration saved successfully");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving settings";
      toast.error(msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveGitSettings = async () => {
    setIsSavingGit(true);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          autoDeploy,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update git settings");
      }

      toast.success("Git deployment settings saved successfully");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving git settings";
      toast.error(msg);
    } finally {
      setIsSavingGit(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setIsRegisteringWebhook(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateSecret: false }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || d.message || "Failed to register webhook");
      }

      if (d.status === "active") {
        toast.success(d.message || "Webhook active on GitHub");
      } else if (d.status === "manual") {
        toast.info(d.message || "Please configure the webhook manually in GitHub repository settings.");
      }
      mutateWebhook();
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error configuring webhook";
      toast.error(msg);
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm("Are you sure you want to regenerate the webhook secret? You will need to update it in your GitHub repository settings.")) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${project._id}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateSecret: true }),
      });

      if (!res.ok) throw new Error("Failed to regenerate secret");
      toast.success("Webhook secret regenerated successfully");
      mutateWebhook();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error regenerating secret";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Git & Automatic Deployments Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git & Automatic Deployments
          </CardTitle>
          <CardDescription>
            Configure automatic deployment triggers from GitHub push events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="settingsBranch">Production Branch</Label>
              <Input
                id="settingsBranch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Push events to this branch trigger automatic production deployments.
              </p>
            </div>
            <div className="space-y-2 flex flex-col justify-center">
              <Label htmlFor="settingsAutoDeploy">Automatic Deployments</Label>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="settingsAutoDeploy"
                  checked={autoDeploy}
                  onChange={(e) => setAutoDeploy(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="settingsAutoDeploy" className="text-xs text-muted-foreground cursor-pointer">
                  {autoDeploy ? "Enabled — Auto-deploy on push" : "Disabled — Manual deployments only"}
                </label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-end bg-muted/10">
          <Button onClick={handleSaveGitSettings} disabled={isSavingGit}>
            {isSavingGit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Git Settings
          </Button>
        </CardFooter>
      </Card>

      {/* GitHub Webhook Triggers Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                GitHub Webhook Configuration
              </CardTitle>
              <CardDescription>
                Webhook credentials and configuration for receiving GitHub push notifications.
              </CardDescription>
            </div>
            {webhookData?.webhookStatus === "active" ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Active on GitHub
              </Badge>
            ) : webhookData?.webhookStatus === "manual" ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                Manual Setup Required
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payload URL</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookData?.webhookUrl || "Loading webhook URL..."}
                className="font-mono text-xs bg-muted/30"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (webhookData?.webhookUrl) {
                    navigator.clipboard.writeText(webhookData.webhookUrl);
                    toast.success("Webhook URL copied to clipboard");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add this Payload URL in your GitHub repository settings under <strong>Settings → Webhooks</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                readOnly
                value={webhookData?.webhookSecret || ""}
                className="font-mono text-xs bg-muted/30"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (webhookData?.webhookSecret) {
                    navigator.clipboard.writeText(webhookData.webhookSecret);
                    toast.success("Webhook secret copied to clipboard");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              HMAC-SHA256 signature secret for authenticating payloads. Never expose this secret.
            </p>
          </div>

          {webhookData?.lastWebhookPayloadAt && (
            <div className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-1">
              <p className="text-xs font-medium text-foreground flex items-center gap-2">
                <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
                Last Received Push Event
              </p>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>Delivery ID: <span className="font-mono">{webhookData.lastWebhookDeliveryId}</span></p>
                <p>Status: <span className="capitalize font-medium">{webhookData.lastWebhookStatus}</span></p>
                <p>Timestamp: {new Date(webhookData.lastWebhookPayloadAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between bg-muted/10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerateSecret}
          >
            Regenerate Secret
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRegisterWebhook}
            disabled={isRegisteringWebhook}
          >
            {isRegisteringWebhook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Register / Verify on GitHub
          </Button>
        </CardFooter>
      </Card>

      {/* Build & Output Settings Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Build & Output Settings
          </CardTitle>
          <CardDescription>
            Configure the commands and directories used to build and deploy this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="settingsRootDir">Root Directory</Label>
              <Input
                id="settingsRootDir"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                placeholder="./ (repository root)"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Directory containing the project files (e.g., <code>apps/web</code> in monorepos).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsPackageManager">Package Manager</Label>
              <Select value={packageManager} onValueChange={(val) => setPackageManager(val || "npm")}>
                <SelectTrigger id="settingsPackageManager" className="text-xs">
                  <SelectValue placeholder="Select package manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="npm">npm</SelectItem>
                  <SelectItem value="pnpm">pnpm</SelectItem>
                  <SelectItem value="yarn">yarn</SelectItem>
                  <SelectItem value="bun">bun</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Used for dependency resolution and script execution.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsDeploymentMode">Deployment Mode</Label>
              <Select value={deploymentMode} onValueChange={(val) => setDeploymentMode(val || "static")}>
                <SelectTrigger id="settingsDeploymentMode" className="text-xs">
                  <SelectValue placeholder="Select deployment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static Site (Cloudflare Pages)</SelectItem>
                  <SelectItem value="ssr">SSR / Edge Runtime</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Defines whether site assets are statically exported.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsBuildCmd">Build Command</Label>
              <Input
                id="settingsBuildCmd"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">The command executed in the build environment.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsOutputDir">Output Directory</Label>
              <Input
                id="settingsOutputDir"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder="dist or .next"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">The directory containing the generated public assets.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsInstallCmd">Install Command</Label>
              <Input
                id="settingsInstallCmd"
                value={installCommand}
                onChange={(e) => setInstallCommand(e.target.value)}
                placeholder="npm install"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">The command used to install package dependencies.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-end bg-muted/10">
          <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
            {isSavingSettings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(`/api/projects/${params.id}`, fetcher);
  const project: ProjectData | undefined = data?.project;

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to trigger deployment");
      }

      const d = await res.json();
      toast.success("Deployment started successfully");
      router.push(`/dashboard/deployments/${d.deployment._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setDeploying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return <div className="p-8 text-destructive text-center">Failed to load project details.</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Connected
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs py-0.5 px-2 ${
                project.deploymentMode === "static"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
              }`}
            >
              {project.deploymentMode === "static" ? "Static Site" : "SSR / Edge"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
              <GitFork className="h-3.5 w-3.5" />
              {project.repository}
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {project.branch}
            </span>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {project.framework}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.packageManager || "npm"}
            </Badge>
            {project.rootDirectory && (
              <span className="flex items-center gap-1 font-mono text-xs">
                <FolderTree className="h-3 w-3" />
                {project.rootDirectory}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.productionUrl && (
            <a
              href={`https://${project.productionUrl}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Visit Site <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          )}
          <Button onClick={handleDeploy} disabled={deploying}>
            {deploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Deploy
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full mt-6">
        <TabsList className="bg-muted/50 border-b border-border/50 w-full justify-start rounded-none h-12 p-0 px-2 space-x-2">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="deployments"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4"
          >
            Deployments
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4"
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4"
          >
            Logs
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="col-span-2 bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Production Deployment</CardTitle>
                <CardDescription>The deployment currently serving traffic for your domain.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="font-medium text-emerald-500">Ready</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {project.updatedAt ? `${formatDistanceToNow(new Date(project.updatedAt))} ago` : "Recently"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Domain</div>
                      {project.productionUrl ? (
                        <a
                          href={`https://${project.productionUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-medium hover:underline"
                        >
                          {project.productionUrl} <ArrowUpRight className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="font-medium">Not deployed yet</span>
                      )}
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Provider</div>
                      <span className="font-medium">Cloudflare Pages</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Branch</div>
                      <span className="font-medium flex items-center gap-1">
                        <GitBranch className="h-3 w-3" /> {project.branch}
                      </span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Framework Preset</div>
                      <span className="font-mono font-medium flex items-center gap-1">
                        <GitFork className="h-3 w-3" /> {project.framework}
                      </span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Package Manager</div>
                      <span className="font-mono font-medium capitalize">{project.packageManager || "npm"}</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Root Directory</div>
                      <span className="font-mono font-medium">{project.rootDirectory || "./ (repository root)"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/dashboard/deployments`)}
                >
                  View Build Logs
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/dashboard/domains`)}
                >
                  Manage Domains
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => router.push(`/dashboard/environment-variables`)}
                >
                  Environment Variables
                </Button>
              </CardContent>
            </Card>
          </div>

          <DeploymentActivityChart />
          <RecentDeploymentsTable projectId={project._id} />
        </TabsContent>

        <TabsContent value="deployments" className="mt-6 space-y-6">
          <RecentDeploymentsTable projectId={project._id} />
        </TabsContent>
        <TabsContent value="analytics">
          <div className="py-8 text-center text-muted-foreground">Analytics view coming soon...</div>
        </TabsContent>
        <TabsContent value="logs">
          <div className="py-8 text-center text-muted-foreground">Runtime logs coming soon...</div>
        </TabsContent>

        {/* Project Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <ProjectSettingsTab project={project} onSaved={() => mutate()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
