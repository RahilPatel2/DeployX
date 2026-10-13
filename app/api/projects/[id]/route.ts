import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import { getSession } from "@/lib/auth/session";

export async function GET(
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
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await connectToDatabase();

    const project = await Project.findOne({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Project GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await connectToDatabase();

    const project = await Project.findOneAndDelete({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Cascade delete project deployments, domains, and webhook deliveries
    await Deployment.deleteMany({ projectId: project._id, userId: session.userId });

    // Clean up registered GitHub webhook if applicable
    if (project.githubWebhookId) {
      try {
        const Integration = (await import("@/models/Integration")).default;
        const integration = await Integration.findOne({ userId: session.userId, provider: "github" });
        const [owner, repo] = (project.repository || "").split("/");
        if (integration?.accessToken && owner && repo) {
          const { deleteRepositoryWebhook } = await import("@/lib/github/webhook");
          await deleteRepositoryWebhook(
            integration.accessToken,
            owner,
            repo,
            project.githubWebhookId
          ).catch(() => {});
        }
      } catch {
        // Non-critical cleanup
      }
    }

    try {
      const WebhookDelivery = (await import("@/models/WebhookDelivery")).default;
      await WebhookDelivery.deleteMany({ projectId: project._id });
    } catch {
      // Ignore if model not available
    }
    
    try {
      const Domain = (await import("@/models/Domain")).default;
      await Domain.deleteMany({ projectId: project._id, userId: session.userId });
    } catch {
      // Ignore if Domain model not available
    }

    // Log activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      type: "project_deleted",
      title: "Project deleted",
      description: `You deleted the project '${project.name}'.`,
      icon: "Trash",
      color: "text-red-500",
    });

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Project DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      branch,
      buildCommand,
      outputDirectory,
      installCommand,
      rootDirectory,
      packageManager,
      deploymentMode,
      autoDeploy,
    } = body;

    await connectToDatabase();

    const project = await Project.findOne({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (name && typeof name === "string") project.name = name.trim();
    if (branch && typeof branch === "string") project.branch = branch.trim();
    if (autoDeploy !== undefined && typeof autoDeploy === "boolean") project.autoDeploy = autoDeploy;
    if (buildCommand !== undefined && typeof buildCommand === "string") project.buildCommand = buildCommand.trim();
    if (outputDirectory !== undefined && typeof outputDirectory === "string") project.outputDirectory = outputDirectory.trim();
    if (installCommand !== undefined && typeof installCommand === "string") project.installCommand = installCommand.trim();

    if (rootDirectory !== undefined && typeof rootDirectory === "string") {
      const { sanitizeRootDirectory } = await import("@/lib/github/framework");
      project.rootDirectory = sanitizeRootDirectory(rootDirectory);
    }

    if (packageManager && ["npm", "pnpm", "yarn", "bun"].includes(packageManager)) {
      project.packageManager = packageManager;
    }

    if (deploymentMode && ["static", "ssr"].includes(deploymentMode)) {
      project.deploymentMode = deploymentMode;
    }

    await project.save();

    // Log activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        projectId: project._id,
        type: "project_updated",
        title: "Project settings updated",
        description: `Settings updated for project '${project.name}'.`,
        icon: "Settings",
        color: "text-amber-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Project PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
