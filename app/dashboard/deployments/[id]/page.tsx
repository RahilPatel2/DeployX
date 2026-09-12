import { getSupabaseServerClient } from "@/lib/database/client";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { LogViewer } from "@/components/deployments/log-viewer";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { rollbackToDeployment } from "./actions";

export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await auth();
  const supabase = getSupabaseServerClient();

  const { data: deployment, error } = await supabase
    .from("deployments")
    .select(`
      *,
      projects (
        id,
        name,
        user_id,
        production_url
      )
    `)
    .eq("id", resolvedParams.id)
    .single();

  if (error || !deployment) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectInfo = Array.isArray(deployment.projects) ? deployment.projects[0] : (deployment.projects as any);

  if (projectInfo?.user_id !== session?.user?.id) {
    return <div className="p-8">Unauthorized.</div>;
  }

  const isActive = projectInfo?.production_url === deployment.deployment_url;
  const canRollback = deployment.status === "READY" && deployment.deployment_url && !isActive;
  
  // Bind rollback action
  const rollbackWithData = rollbackToDeployment.bind(null, deployment.id, projectInfo?.id, deployment.deployment_url || "");

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/projects/${projectInfo?.id}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <span>{projectInfo?.name}</span>
            <span className="text-muted-foreground font-normal text-lg">/</span>
            <span className="text-muted-foreground font-normal text-lg">{deployment.id.substring(0, 8)}</span>
          </h2>
          <div className="text-sm text-muted-foreground flex space-x-4">
            <span>Branch: {deployment.branch}</span>
            <span>Commit: {deployment.commit_sha.substring(0, 7)}</span>
            <span>Environment: {deployment.environment}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          {canRollback && (
            <form action={rollbackWithData}>
              <Button type="submit" variant="secondary">Rollback to this Deployment</Button>
            </form>
          )}
          {deployment.deployment_url && (
            <a 
              href={deployment.deployment_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className={buttonVariants({ variant: isActive ? "default" : "outline" })}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Visit Preview
            </a>
          )}
        </div>
      </div>

      <LogViewer deploymentId={deployment.id} />
    </div>
  );
}
