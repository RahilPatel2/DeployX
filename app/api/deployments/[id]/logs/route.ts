import { NextResponse } from "next/server";
import mongoose from "mongoose";
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
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    await connectToDatabase();

    const deployment = await Deployment.findOne({ _id: id, userId: session.userId });
    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const tailParam = searchParams.get("tail");
    const tail = tailParam ? Math.min(Math.max(parseInt(tailParam, 10), 1), 2000) : null;
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "1000", 10), 1), 5000);

    let allLogs: string[] = Array.isArray(deployment.logs) ? deployment.logs : [];

    // If local logs are empty and a Cloudflare deployment exists, attempt Cloudflare log retrieval
    if (allLogs.length === 0 && deployment.cloudflareDeploymentId) {
      const project = await Project.findOne({ _id: deployment.projectId, userId: session.userId })
        .select("cloudflareProjectName")
        .lean();
      if (project && project.cloudflareProjectName) {
        try {
          const logsData = await CloudflareProvider.getDeploymentLogs(project.cloudflareProjectName, deployment.cloudflareDeploymentId);
          const cfLogs = Array.isArray(logsData.data)
            ? logsData.data.map((l: { line?: string }) => l.line || "").filter(Boolean)
            : [];

          if (cfLogs.length > 0) {
            allLogs = cfLogs;
            deployment.logs = cfLogs;
            await deployment.save();
          }
        } catch {
          // Ignore CF log fetch error and proceed
        }
      }
    }

    const { redactLogs } = await import("@/lib/security/redaction");
    const sanitizedLogs = redactLogs(allLogs);
    const totalLines = sanitizedLogs.length;

    const paginatedLogs = tail !== null
      ? sanitizedLogs.slice(-tail)
      : sanitizedLogs.slice(offset, offset + limit);

    return NextResponse.json({
      logs: paginatedLogs,
      totalLines,
      offset: tail !== null ? Math.max(0, totalLines - tail) : offset,
      limit: tail !== null ? tail : limit,
      isTailed: tail !== null,
      hasMore: tail !== null ? totalLines > tail : offset + limit < totalLines,
      emptyMessage: totalLines === 0 ? "No build logs recorded yet for this deployment." : undefined,
    });

  } catch (error) {
    console.error("Deployment Logs GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
