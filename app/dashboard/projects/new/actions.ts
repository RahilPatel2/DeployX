"use server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/database/client";
import { redirect } from "next/navigation";
import { detectFramework } from "@/lib/github/framework";

export async function createProjectAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // @ts-expect-error We added accessToken in auth.ts
  const accessToken = session.accessToken as string;

  const repoId = formData.get("repoId") as string;
  const repoName = formData.get("repoName") as string;
  const repoFullName = formData.get("repoFullName") as string;
  const repoOwner = formData.get("repoOwner") as string;
  const defaultBranch = formData.get("defaultBranch") as string;
  const language = formData.get("language") as string;

  // Detect Framework
  const frameworkData = await detectFramework(accessToken, repoOwner, repoName, language);

  const supabase = getSupabaseServerClient();

  // Create Project in DB
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: session.user.id,
      name: repoFullName.replace(/\//g, "-").toLowerCase(),
      repository_id: repoId,
      repository_name: repoName,
      repository_owner: repoOwner,
      branch: defaultBranch,
      framework: frameworkData.framework,
      build_command: frameworkData.buildCommand,
      install_command: frameworkData.installCommand,
      output_directory: frameworkData.outputDirectory,
      status: "CREATED",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create project", error);
    // In a real app we'd return the error to the UI
    throw new Error("Failed to create project");
  }

  // Redirect to project page
  redirect(`/dashboard/projects/${project.id}`);
}
