import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import Integration from "@/models/Integration";
import Activity from "@/models/Activity";
import { getSession } from "@/lib/auth/session";
import { evaluateDeploymentTarget } from "@/lib/cloudflare/provider";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    await connectToDatabase();

    // 1. Enforce historical deployment ownership
    const historical = await Deployment.findOne({ _id: id, userId: session.userId });
    if (!historical) {
      return NextResponse.json({ error: "Deployment not found or access denied" }, { status: 404 });
    }

    // 2. Enforce parent project ownership
    const project = await Project.findOne({ _id: historical.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Associated project not found or access denied" }, { status: 404 });
    }

    // 3. Duplicate Operation Protection (30s concurrent block)
    const activeRecent = await Deployment.findOne({
      projectId: project._id,
      userId: session.userId,
      status: { $in: ["QUEUED", "BUILDING"] },
      createdAt: { $gt: new Date(Date.now() - 30 * 1000) },
    });

    if (activeRecent) {
      return NextResponse.json(
        {
          error: "A deployment is already in progress for this project. Please wait for it to complete.",
          deploymentId: activeRecent._id,
        },
        { status: 409 }
      );
    }

    // 4. Revalidate framework target compatibility
    const targetEval = evaluateDeploymentTarget({
      framework: project.framework,
      deploymentMode: project.deploymentMode,
      rootDirectory: project.rootDirectory,
      buildCommand: project.buildCommand,
      outputDirectory: project.outputDirectory,
    });

    if (!targetEval.compatible) {
      return NextResponse.json(
        {
          error: `Incompatible deployment target: ${targetEval.reason}`,
          recommendation: targetEval.recommendation,
        },
        { status: 422 }
      );
    }

    // 5. Verify GitHub Integration
    const integration = await Integration.findOne({ userId: session.userId, provider: "github" });
    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: "GitHub integration is not connected. Please connect your GitHub account in settings before redeploying." },
        { status: 400 }
      );
    }

    // 6. Determine target commit SHA (prefer historical pinned commit for reproducibility)
    const body = await req.json().catch(() => ({}));
    const [owner, repo] = (project.repository || "").split("/");
    if (!owner || !repo) {
      return NextResponse.json({ error: "Invalid repository format" }, { status: 400 });
    }

    let targetCommitSha = historical.commitHash;
    let targetCommitMessage = historical.commitMessage || `Redeploy of #${historical._id.toString().slice(-6)}`;

    // If explicit latest head requested or historical has no commitHash, fetch branch head
    if (body.useLatestBranchHead || !targetCommitSha) {
      try {
        const { getBranchCommit } = await import("@/lib/github/api");
        const commitInfo = await getBranchCommit(integration.accessToken, owner, repo, historical.branch);
        targetCommitSha = commitInfo.sha;
        targetCommitMessage = commitInfo.message;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to verify repository on GitHub.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // 7. Create a NEW deployment record (never overwrite historical deployment)
    const newDeployment = await Deployment.create({
      projectId: project._id,
      userId: session.userId,
      status: "QUEUED",
      branch: historical.branch,
      commitHash: targetCommitSha,
      commitMessage: `Redeploy: ${targetCommitMessage}`,
      previousDeploymentId: historical._id,
      trigger: "redeploy",
      environment: historical.environment || "Production",
      buildConfigSnapshot: historical.buildConfigSnapshot || {
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
        installCommand: project.installCommand,
        rootDirectory: project.rootDirectory,
        framework: project.framework,
      },
      logs: [
        `[DeployX] Redeployment initiated from historical build #${historical._id.toString().slice(-6)}`,
        `[DeployX] Targeted commit: ${targetCommitSha ? targetCommitSha.slice(0, 7) : historical.branch}`,
      ],
    });

    // 8. Record Activity Audit Log
    await Activity.create({
      userId: session.userId,
      projectId: project._id,
      type: "deployment_started",
      title: "Redeployment started",
      description: `Redeployment #${newDeployment._id.toString().slice(-6)} started for '${project.name}'.`,
      icon: "Activity",
      color: "text-blue-500",
    });

    // 9. Launch Build Pipeline Asynchronously
    const { runBuildPipeline } = await import("@/lib/build/pipeline");
    runBuildPipeline(newDeployment._id.toString()).catch((err) => {
      console.error(`Redeploy pipeline error for ${newDeployment._id}:`, err);
    });

    return NextResponse.json({ deployment: newDeployment }, { status: 201 });
  } catch (error: unknown) {
    console.error("Redeploy POST error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
