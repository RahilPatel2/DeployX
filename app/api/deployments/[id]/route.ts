import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";
import { CloudflareProvider } from "@/lib/cloudflare/provider";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const deployment = await Deployment.findOne({ _id: id, userId: session.userId });
    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    // Sync status with Cloudflare if it's not terminal
    if (deployment.cloudflareDeploymentId && ['QUEUED', 'BUILDING'].includes(deployment.status)) {
      try {
        const project = await Project.findById(deployment.projectId);
        if (project && project.cloudflareProjectName) {
           const cfData = await CloudflareProvider.getDeployment(project.cloudflareProjectName, deployment.cloudflareDeploymentId);
           
           // map CF status to our status
           // CF status: 'queued', 'initializing', 'cloning', 'building', 'active', 'success', 'failure', 'canceled'
           let newStatus = deployment.status;
           if (['success', 'active'].includes(cfData.latest_stage?.status)) newStatus = 'READY';
           if (cfData.latest_stage?.status === 'failure') newStatus = 'FAILED';
           if (cfData.latest_stage?.status === 'canceled') newStatus = 'CANCELED';
           if (['initializing', 'cloning', 'building'].includes(cfData.latest_stage?.status)) newStatus = 'BUILDING';

           if (newStatus !== deployment.status) {
             deployment.status = newStatus;
             
             // If terminal, log activity
             if (['READY', 'FAILED', 'CANCELED'].includes(newStatus)) {
                const Activity = (await import("@/models/Activity")).default;
                await Activity.create({
                  userId: session.userId,
                  projectId: project._id,
                  type: `deployment_${newStatus.toLowerCase()}`,
                  title: `Deployment ${newStatus.toLowerCase()}`,
                  description: `Deployment for '${project.name}' finished with status ${newStatus}.`,
                  icon: newStatus === 'READY' ? "CheckCircle" : "XCircle",
                  color: newStatus === 'READY' ? "text-emerald-500" : "text-red-500",
                });
             }

             await deployment.save();
           }
        }
      } catch (cfError) {
        console.error("Failed to sync deployment status:", cfError);
      }
    }

    return NextResponse.json({ deployment });
  } catch (error) {
    console.error("Deployment GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
