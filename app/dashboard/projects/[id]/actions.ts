"use server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/database/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProjectSettings(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const buildCommand = formData.get("buildCommand") as string;
  const installCommand = formData.get("installCommand") as string;
  const outputDirectory = formData.get("outputDirectory") as string;
  const framework = formData.get("framework") as string;

  const supabase = getSupabaseServerClient();
  
  // Verify ownership
  const { data: project } = await supabase.from("projects").select("user_id").eq("id", projectId).single();
  if (project?.user_id !== session.user.id) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("projects")
    .update({
      build_command: buildCommand,
      install_command: installCommand,
      output_directory: outputDirectory,
      framework: framework,
    })
    .eq("id", projectId);

  if (error) {
    console.error("Failed to update project", error);
    throw new Error("Failed to update project settings");
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
}

import { deploymentProvider } from "@/lib/deployments/local-provider";

export async function triggerDeploymentAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const supabase = getSupabaseServerClient();
  
  // Verify ownership and get project details
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (project?.user_id !== session.user.id) throw new Error("Unauthorized");

  // Create Deployment Record
  const { data: deployment, error } = await supabase
    .from("deployments")
    .insert({
      project_id: projectId,
      commit_sha: "HEAD", // In a real app we'd fetch the latest commit SHA from GitHub
      branch: project.branch,
      environment: "production",
      status: "QUEUED",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !deployment) {
    console.error("Failed to create deployment record", error);
    throw new Error("Failed to trigger deployment");
  }

  // Trigger the deployment pipeline asynchronously
  await deploymentProvider.createDeployment(deployment.id, projectId);

  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/deployments/${deployment.id}`);
}
