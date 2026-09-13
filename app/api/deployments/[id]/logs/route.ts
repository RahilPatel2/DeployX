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

    if (!deployment.cloudflareDeploymentId) {
       return NextResponse.json({ logs: ["No Cloudflare deployment found."] });
    }

    const project = await Project.findById(deployment.projectId);
    if (!project || !project.cloudflareProjectName) {
       return NextResponse.json({ logs: ["No Cloudflare project connected."] });
    }

    try {
      const logsData = await CloudflareProvider.getDeploymentLogs(project.cloudflareProjectName, deployment.cloudflareDeploymentId);
      // logsData is usually an object containing { data: [{line, timestamp}] } depending on CF Pages API.
      // We map it to an array of strings for simplicity
      const logs = logsData.data ? logsData.data.map((l: any) => l.line) : [];
      
      // Save it locally too
      if (logs.length > 0) {
         deployment.logs = logs;
         await deployment.save();
      }

      return NextResponse.json({ logs: logs.length > 0 ? logs : deployment.logs || [] });
    } catch (cfError) {
      // If fetching fails, return cached logs
      return NextResponse.json({ logs: deployment.logs || ["Failed to fetch live logs from Cloudflare."] });
    }

  } catch (error) {
    console.error("Deployment Logs GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
