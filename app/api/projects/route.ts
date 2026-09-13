import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";
import { CloudflareProvider } from "@/lib/cloudflare/provider";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    // Allow sorting and filtering via search params if needed
    const projects = await Project.find({ userId: session.userId }).sort({ createdAt: -1 }).limit(100).lean();

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Projects GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, repository, framework, branch, buildCommand, outputDirectory, installCommand } = body;

    if (!name || !repository) {
      return NextResponse.json({ error: "Name and repository are required" }, { status: 400 });
    }

    await connectToDatabase();

    // Create a URL-safe slug that also acts as the CF project name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    let cloudflareProjectName = slug;
    
    // Attempt to create Cloudflare project
    try {
      await CloudflareProvider.createProject(cloudflareProjectName, branch || 'main', repository, buildCommand || 'npm run build', outputDirectory || '.next');
    } catch (cfError: any) {
      console.error("Cloudflare creation failed:", cfError.message);
      // We log the error but still create the project locally, 
      // allowing the user to retry deployment/connection later or diagnosing CF permissions.
    }

    const project = await Project.create({
      name,
      slug,
      userId: session.userId,
      repository,
      framework,
      branch: branch || 'main',
      buildCommand,
      outputDirectory,
      installCommand,
      cloudflareProjectName,
      productionUrl: `${cloudflareProjectName}.pages.dev`
    });

    // Also log activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      projectId: project._id,
      type: "project_created",
      title: "Project created",
      description: `You created the project '${project.name}'.`,
      icon: "Box",
      color: "text-blue-500",
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Projects POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
