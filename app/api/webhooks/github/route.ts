import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/database/client";
import { deploymentProvider } from "@/lib/deployments/local-provider";

export async function POST(req: Request) {
  try {
    const event = req.headers.get("x-github-event");
    
    // We only care about push events
    if (event !== "push") {
      return NextResponse.json({ message: "Ignored event type" }, { status: 200 });
    }

    const payload = await req.json();
    
    const repositoryId = payload.repository?.id?.toString();
    const ref = payload.ref; // e.g., refs/heads/main
    const commitSha = payload.head_commit?.id || payload.after;
    
    if (!repositoryId || !ref) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const branch = ref.replace("refs/heads/", "");

    const supabase = getSupabaseServerClient();

    // Find projects linked to this repository
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, branch")
      .eq("repository_id", repositoryId);

    if (error || !projects || projects.length === 0) {
      return NextResponse.json({ message: "No matching projects" }, { status: 200 });
    }

    const deploymentsTriggered = [];

    // Trigger deployments for all branches
    for (const project of projects) {
      const environment = project.branch === branch ? "production" : "preview";

      // Create deployment record
      const { data: deployment, error: deployError } = await supabase
        .from("deployments")
        .insert({
          project_id: project.id,
          commit_sha: commitSha,
          branch: branch,
          environment: environment,
          status: "QUEUED",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (deployError || !deployment) {
        console.error("Failed to create deployment record for webhook", deployError);
        continue;
      }

      // Trigger pipeline
      await deploymentProvider.createDeployment(deployment.id, project.id);
      deploymentsTriggered.push(deployment.id);
    }

    return NextResponse.json({ 
      message: `Triggered ${deploymentsTriggered.length} deployments`,
      deployments: deploymentsTriggered 
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
