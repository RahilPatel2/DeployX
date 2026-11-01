import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Domain from "@/models/Domain";
import Project from "@/models/Project";
import Notification from "@/models/Notification";
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

    // Strict FQDN hostname validation
    const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!DOMAIN_REGEX.test(normalizedDomain) || normalizedDomain.includes("localhost") || normalizedDomain.length > 253) {
      return NextResponse.json(
        { error: "Invalid domain name format. Must be a valid fully qualified domain name (e.g. app.example.com)." },
        { status: 400 }
      );
    }

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

    await Notification.create({
      userId: session.userId,
      title: "Domain connected",
      message: `Domain ${normalizedDomain} was linked to project "${project.name}"`,
      category: "project",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ domain: newDomain }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === 11000) {
      return NextResponse.json({ error: "This domain is already registered." }, { status: 409 });
    }
    console.error("Domains POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Valid domain ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const domain = await Domain.findOne({ _id: id, userId: session.userId });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Simulate verification
    if (action === "verify" || !action) {
      domain.status = "active";
      domain.verificationData = {
        verifiedAt: new Date(),
        method: "CNAME",
        target: "cname.deployx.app",
      };
      await domain.save();

      await Notification.create({
        userId: session.userId,
        title: "Domain verified",
        message: `Domain ${domain.domain} has been verified and is now active`,
        category: "project",
        read: false,
      }).catch(() => {});
    }

    return NextResponse.json({ domain });
  } catch (error) {
    console.error("Domains PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get("id");

    if (!domainId || !mongoose.isValidObjectId(domainId)) {
      return NextResponse.json({ error: "Valid domain ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    // Enforce strict ownership check - prevent deleting domains of other users
    const domain = await Domain.findOneAndDelete({ _id: domainId, userId: session.userId });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found or access denied" }, { status: 404 });
    }

    await Notification.create({
      userId: session.userId,
      title: "Domain removed",
      message: `Domain ${domain.domain} was removed`,
      category: "project",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ message: "Domain deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Domains DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

