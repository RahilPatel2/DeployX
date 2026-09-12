"use server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/database/client";

export async function getDeploymentLogsAndStatus(deploymentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const supabase = getSupabaseServerClient();
  
  // Verify ownership
  const { data: deployment } = await supabase
    .from("deployments")
    .select(`
      status,
      projects (
        user_id
      )
    `)
    .eq("id", deploymentId)
    .single();

  const projectUserId = Array.isArray(deployment?.projects) 
    ? deployment.projects[0]?.user_id 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (deployment?.projects as any)?.user_id;

  if (!deployment || projectUserId !== session.user.id) {
    throw new Error("Unauthorized or not found");
  }

  // Fetch logs
  const { data: logs } = await supabase
    .from("build_logs")
    .select("created_at, level, message")
    .eq("deployment_id", deploymentId)
    .order("created_at", { ascending: true });

  return {
    status: deployment.status as string,
    logs: logs || []
  };
}
