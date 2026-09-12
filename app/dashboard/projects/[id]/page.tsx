import { getSupabaseServerClient } from "@/lib/database/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProjectSettings, triggerDeploymentAction } from "./actions";
import { EnvVars } from "@/components/projects/env-vars";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await auth();
  const supabase = getSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch project deployments
  const { data: projectDeployments } = await supabase
    .from("deployments")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  // Fetch environment variables
  const { data: envVars } = await supabase
    .from("environment_variables")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  if (project.user_id !== session?.user?.id) {
    return <div className="p-8">Unauthorized.</div>;
  }

  // Bind the projectId to the actions
  const updateSettingsWithId = updateProjectSettings.bind(null, project.id);
  const triggerDeploymentWithId = triggerDeploymentAction.bind(null, project.id);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
        <form action={triggerDeploymentWithId}>
          <Button type="submit">Deploy Now</Button>
        </form>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="env-vars">Environment Variables</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Repository</dt>
                  <dd className="mt-1 text-sm">{project.repository_owner}/{project.repository_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Branch</dt>
                  <dd className="mt-1 text-sm">{project.branch}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Framework</dt>
                  <dd className="mt-1 text-sm">{project.framework || "None"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1 text-sm">{project.status}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployments</CardTitle>
              <CardDescription>History of production and preview deployments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                {!projectDeployments || projectDeployments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No deployments yet.</div>
                ) : (
                  projectDeployments.map((dep) => (
                    <div key={dep.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div>
                          <Link href={`/dashboard/deployments/${dep.id}`} className="font-semibold hover:underline">
                            {dep.commit_sha.substring(0, 7)}
                          </Link>
                          <div className="flex items-center text-sm text-muted-foreground space-x-4 mt-1">
                            <span>Branch: {dep.branch}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{dep.status}</div>
                        <div className="text-xs text-muted-foreground capitalize">{dep.environment}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <form action={updateSettingsWithId}>
              <CardHeader>
                <CardTitle>Build & Development Settings</CardTitle>
                <CardDescription>
                  Configure how DeployX builds and serves your project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="framework">Framework Preset</Label>
                  <Input id="framework" name="framework" defaultValue={project.framework || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buildCommand">Build Command</Label>
                  <Input id="buildCommand" name="buildCommand" defaultValue={project.build_command || ""} placeholder="npm run build" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installCommand">Install Command</Label>
                  <Input id="installCommand" name="installCommand" defaultValue={project.install_command || ""} placeholder="npm install" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputDirectory">Output Directory</Label>
                  <Input id="outputDirectory" name="outputDirectory" defaultValue={project.output_directory || ""} placeholder="public, dist, .next" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">Save Changes</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="env-vars" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                Securely store secrets and configuration for your deployments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnvVars projectId={project.id} envVars={envVars || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
