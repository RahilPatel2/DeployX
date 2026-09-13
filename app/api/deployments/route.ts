import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";
import { CloudflareProvider } from "@/lib/cloudflare/provider";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const project = await Project.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.cloudflareProjectName) {
       return NextResponse.json({ error: "Project is not connected to Cloudflare" }, { status: 400 });
    }

    // Create Cloudflare Deployment
    let cfDeployment;
    try {
      cfDeployment = await CloudflareProvider.createDeployment(project.cloudflareProjectName, project.branch);
    } catch (cfError: any) {
      console.error("Cloudflare deploy failed:", cfError.message);
      return NextResponse.json({ error: cfError.message || "Failed to trigger Cloudflare deployment" }, { status: 502 });
    }

    const deployment = await Deployment.create({
      projectId: project._id,
      userId: session.userId,
      cloudflareDeploymentId: cfDeployment.id,
      status: 'QUEUED',
      branch: project.branch,
      url: cfDeployment.url || project.productionUrl,
      environment: cfDeployment.environment || 'Production',
      commitHash: cfDeployment.source?.commit_hash,
      commitMessage: cfDeployment.source?.commit_message
    });

    // Also log activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      projectId: project._id,
      type: "deployment_started",
      title: "Deployment started",
      description: `Deployment started for '${project.name}'.`,
      icon: "Activity",
      color: "text-blue-500",
    });

    return NextResponse.json({ deployment }, { status: 201 });
  } catch (error) {
    console.error("Deployments POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    await connectToDatabase();
    
    let query: any = { userId: session.userId };
    if (projectId) {
      query.projectId = projectId;
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const deployments = await Deployment.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error("Deployments GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
