import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/database/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, GitBranch, GitCommit, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

function StatusIcon({ status }: { status: string }) {
  if (status === "READY") return <CheckCircle className="h-5 w-5 text-emerald-500" />;
  if (status === "FAILED") return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === "CANCELLED") return <XCircle className="h-5 w-5 text-muted-foreground" />;
  return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
}

export default async function DeploymentsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const supabase = getSupabaseServerClient();
  
  // Fetch deployments for this user's projects
  const { data: deployments } = await supabase
    .from("deployments")
    .select(`
      *,
      projects (
        name,
        user_id
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  // Filter deployments where the project belongs to the user
  const userDeployments = deployments?.filter(d => d.projects?.user_id === session.user?.id) || [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Deployments</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>All recent deployments across your projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            {userDeployments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Activity className="h-10 w-10 mb-4 opacity-20" />
                No deployments found. Trigger a deployment from a project to see it here.
              </div>
            ) : (
              userDeployments.map((deployment) => (
                <div key={deployment.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <StatusIcon status={deployment.status} />
                    <div>
                      <Link href={`/dashboard/deployments/${deployment.id}`} className="font-semibold hover:underline">
                        {deployment.projects?.name}
                      </Link>
                      <div className="flex items-center text-sm text-muted-foreground space-x-4 mt-1">
                        <div className="flex items-center">
                          <GitBranch className="h-3 w-3 mr-1" />
                          {deployment.branch}
                        </div>
                        <div className="flex items-center">
                          <GitCommit className="h-3 w-3 mr-1" />
                          {deployment.commit_sha.substring(0, 7)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{deployment.status}</div>
                    <div className="text-xs text-muted-foreground">{deployment.environment}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
