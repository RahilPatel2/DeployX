import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Domain from "@/models/Domain";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    await connectToDatabase();

    interface DomainFilter {
      userId: string;
      projectId?: string;
    }

    const filter: DomainFilter = { userId: String(session.userId) };
    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return NextResponse.json({ domains: [] });
      }
      filter.projectId = projectId;
    }

    const domains = await Domain.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("Domains GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { domain, projectId } = body;

    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "Domain name is required" }, { status: 400 });
    }

    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      return NextResponse.json({ error: "Valid projectId is required" }, { status: 400 });
    }

    await connectToDatabase();

    // Verify project belongs to authenticated user
    const project = await Project.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found or not owned by user" }, { status: 404 });
    }

    const normalizedDomain = domain.toLowerCase().trim();

    // Check if domain already registered
    const existing = await Domain.findOne({ domain: normalizedDomain });
    if (existing) {
      return NextResponse.json({ error: "This domain is already registered." }, { status: 409 });
    }

    const newDomain = await Domain.create({
      userId: session.userId,
      projectId: project._id,
      domain: normalizedDomain,
      status: "pending",
    });

    return NextResponse.json({ domain: newDomain }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === 11000) {
      return NextResponse.json({ error: "This domain is already registered." }, { status: 409 });
    }
    console.error("Domains POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
