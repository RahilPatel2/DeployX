import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";
import {
  CloudflareProvider,
  evaluateDeploymentTarget,
  mapCloudflareStatus,
} from "@/lib/cloudflare/provider";

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      return NextResponse.json({ error: "Valid Project ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Enforce Project Ownership server-side
    const project = await Project.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // 2. Duplicate Operation Protection
    // Block duplicate deployment requests if one was initiated within the last 30 seconds and is still active
    const activeRecentDeployment = await Deployment.findOne({
      projectId: project._id,
      userId: session.userId,
      status: { $in: ["QUEUED", "BUILDING"] },
      createdAt: { $gt: new Date(Date.now() - 30 * 1000) },
    });

    if (activeRecentDeployment) {
      return NextResponse.json(
        {
          error: "A deployment is already in progress for this project. Please wait for it to complete.",
          deploymentId: activeRecentDeployment._id,
        },
        { status: 409 }
      );
    }

    // 3. Evaluate Deployment Target Compatibility
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

    // 4. Validate GitHub Integration and Access
    const Integration = (await import("@/models/Integration")).default;
    const integration = await Integration.findOne({ userId: session.userId, provider: "github" });

    // If GitHub integration is not connected, check if project already has a configured Cloudflare Pages project
    if (!integration || !integration.accessToken) {
      if (!project.cloudflareProjectName) {
        return NextResponse.json(
          { error: "GitHub integration is not connected. Please connect your GitHub account in settings before deploying." },
          { status: 400 }
        );
      }

      // Direct Cloudflare Pages deployment trigger (for projects linked directly via Cloudflare Pages)
      let cfDeployment;
      try {
        cfDeployment = await CloudflareProvider.createDeployment(project.cloudflareProjectName, project.branch);
      } catch (cfError: unknown) {
        const msg = cfError instanceof Error ? cfError.message : "Failed to trigger Cloudflare deployment";
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const initialStatus = mapCloudflareStatus(cfDeployment.latest_stage?.status);
      const deployment = await Deployment.create({
        projectId: project._id,
        userId: session.userId,
        cloudflareDeploymentId: cfDeployment.id,
        status: initialStatus,
        branch: project.branch,
        url: cfDeployment.url || undefined,
        environment: cfDeployment.environment || "Production",
        commitHash: cfDeployment.deployment_trigger?.metadata?.commit_hash,
        commitMessage: cfDeployment.deployment_trigger?.metadata?.commit_message,
      });

      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        projectId: project._id,
        type: "deployment_started",
        title: "Deployment started",
        description: `Deployment #${deployment._id.toString().slice(-6)} started for '${project.name}' on branch '${project.branch}'.`,
        icon: "Activity",
        color: "text-blue-500",
      });

      return NextResponse.json({ deployment }, { status: 201 });
    }

    // 5. Verify Repository & Branch Access and Pin Commit SHA
    const [owner, repo] = (project.repository || "").split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        { error: `Invalid repository identifier '${project.repository}'. Expected format 'owner/repo'.` },
        { status: 400 }
      );
    }

    let commitInfo;
    try {
      const { getBranchCommit } = await import("@/lib/github/api");
      commitInfo = await getBranchCommit(integration.accessToken, owner, repo, project.branch);
    } catch (ghError: unknown) {
      const msg = ghError instanceof Error ? ghError.message : "Failed to verify repository or branch on GitHub.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 6. Create Initial Deployment Record (QUEUED state, pinned commit)
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: session.userId,
      status: "QUEUED",
      branch: project.branch,
      commitHash: commitInfo.sha,
      commitMessage: commitInfo.message,
      environment: "Production",
      trigger: "manual",
      buildConfigSnapshot: {
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
        installCommand: project.installCommand,
        rootDirectory: project.rootDirectory,
        framework: project.framework,
      },
      logs: [
        `[DeployX] Deployment initiated on branch '${project.branch}'`,
        `[DeployX] Pinned commit ${commitInfo.shortSha}: "${commitInfo.message}"`,
      ],
    });

    // 7. Record Activity Audit Log
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      projectId: project._id,
      type: "deployment_started",
      title: "Deployment started",
      description: `Deployment #${deployment._id.toString().slice(-6)} started for '${project.name}' on branch '${project.branch}'.`,
      icon: "Activity",
      color: "text-blue-500",
    });

    // 8. Launch Build & Deployment Pipeline Asynchronously
    const { runBuildPipeline } = await import("@/lib/build/pipeline");
    runBuildPipeline(deployment._id.toString()).catch((pipelineErr) => {
      console.error(`Build pipeline background error for ${deployment._id}:`, pipelineErr);
    });

    return NextResponse.json({ deployment }, { status: 201 });
  } catch (error: unknown) {
    console.error("Deployments POST error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status")?.toUpperCase();
    const branch = searchParams.get("branch");
    const search = searchParams.get("search");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Auto-recover any stale deployments for this user
    const { recoverStaleDeployments } = await import("@/lib/build/recovery");
    await recoverStaleDeployments({ userId: String(session.userId) }).catch(() => {});

    const query: Record<string, unknown> = { userId: session.userId };

    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return NextResponse.json({
          deployments: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
      query.projectId = projectId;
    }

    if (status && ["QUEUED", "BUILDING", "READY", "FAILED", "CANCELED"].includes(status)) {
      query.status = status;
    }

    if (branch && branch.trim()) {
      query.branch = branch.trim();
    }

    if (search && search.trim()) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { commitMessage: { $regex: sanitizedSearch, $options: "i" } },
        { commitHash: { $regex: sanitizedSearch, $options: "i" } },
        { branch: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    const [deployments, total] = await Promise.all([
      Deployment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Deployment.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      deployments,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error: unknown) {
    console.error("Deployments GET error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
