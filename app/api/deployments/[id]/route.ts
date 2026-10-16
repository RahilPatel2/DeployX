import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";
import { CloudflareProvider, mapCloudflareStatus } from "@/lib/cloudflare/provider";

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
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    await connectToDatabase();

    // Enforce user account isolation
    const deployment = await Deployment.findOne({ _id: id, userId: session.userId });
    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    // Synchronize live status with Cloudflare if not in a terminal state
    if (deployment.cloudflareDeploymentId && ["QUEUED", "BUILDING"].includes(deployment.status)) {
      try {
        const project = await Project.findOne({ _id: deployment.projectId, userId: session.userId });
        if (project && project.cloudflareProjectName) {
          const cfData = await CloudflareProvider.getDeployment(
            project.cloudflareProjectName,
            deployment.cloudflareDeploymentId
          );

          const newStatus = mapCloudflareStatus(cfData.latest_stage?.status);

          let hasChanges = false;

          if (newStatus !== deployment.status) {
            deployment.status = newStatus;
            hasChanges = true;

            // If terminal, log activity
            if (["READY", "FAILED", "CANCELED"].includes(newStatus)) {
              const Activity = (await import("@/models/Activity")).default;
              await Activity.create({
                userId: session.userId,
                projectId: project._id,
                type: `deployment_${newStatus.toLowerCase()}`,
                title: `Deployment ${newStatus.toLowerCase()}`,
                description: `Deployment #${deployment._id.toString().slice(-6)} for '${project.name}' finished with status ${newStatus}.`,
                icon: newStatus === "READY" ? "CheckCircle" : "XCircle",
                color: newStatus === "READY" ? "text-emerald-500" : "text-red-500",
              });
            }
          }

          // Persist real preview URL when Cloudflare assigns it
          if (cfData.url && deployment.url !== cfData.url) {
            deployment.url = cfData.url;
            hasChanges = true;

            // If deployment succeeded on production branch, assign official productionUrl
            if (newStatus === "READY" && project.branch === deployment.branch) {
              project.productionUrl = cfData.url.replace(/^https?:\/\//, "");
              await project.save();
            }
          }

          // Calculate duration if stages have timestamps
          if (cfData.latest_stage?.started_on && cfData.latest_stage?.ended_on) {
            const startMs = new Date(cfData.latest_stage.started_on).getTime();
            const endMs = new Date(cfData.latest_stage.ended_on).getTime();
            if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
              deployment.duration = Math.max(Math.round((endMs - startMs) / 1000), 1);
              hasChanges = true;
            }
          }

          if (hasChanges) {
            await deployment.save();
          }
        }
      } catch (cfError) {
        console.error("Failed to sync deployment status with Cloudflare:", cfError);
      }
    }

    return NextResponse.json({ deployment });
  } catch (error: unknown) {
    console.error("Deployment GET error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
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
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== "cancel") {
      return NextResponse.json({ error: "Unsupported deployment action" }, { status: 400 });
    }

    await connectToDatabase();

    // Enforce user account isolation & ownership
    const deployment = await Deployment.findOne({ _id: id, userId: session.userId });
    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (!["QUEUED", "BUILDING"].includes(deployment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel deployment with status '${deployment.status}'.` },
        { status: 400 }
      );
    }

    deployment.status = "CANCELED";
    deployment.logs = [
      ...(Array.isArray(deployment.logs) ? deployment.logs : []),
      `[DeployX] Deployment canceled by user at ${new Date().toISOString()}`,
    ];
    await deployment.save();

    return NextResponse.json({
      success: true,
      message: "Deployment canceled successfully",
      deployment,
    });
  } catch (error: unknown) {
    console.error("Deployment PATCH error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

