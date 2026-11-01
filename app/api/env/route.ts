import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import EnvironmentVariable from "@/models/EnvironmentVariable";
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

    const query: Record<string, unknown> = { userId: session.userId };
    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return NextResponse.json({ variables: [] });
      }
      query.projectId = projectId;
    }

    const variables = await EnvironmentVariable.find(query)
      .populate("projectId", "name slug")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ variables });
  } catch (error) {
    console.error("Env vars GET error:", error);
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
    const { key, value, projectId, targetEnvironments } = body;

    if (!key || typeof key !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key.trim())) {
      return NextResponse.json(
        { error: "Variable key must contain only letters, numbers, and underscores, and cannot start with a number." },
        { status: 400 }
      );
    }

    if (value === undefined || value === null || typeof value !== "string") {
      return NextResponse.json({ error: "Variable value is required" }, { status: 400 });
    }

    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      return NextResponse.json({ error: "Valid projectId is required" }, { status: 400 });
    }

    await connectToDatabase();

    const project = await Project.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const cleanKey = key.trim();
    const envs = Array.isArray(targetEnvironments) && targetEnvironments.length > 0
      ? targetEnvironments
      : ["production", "preview", "development"];

    const variable = await EnvironmentVariable.findOneAndUpdate(
      { userId: session.userId, projectId: project._id, key: cleanKey },
      {
        userId: session.userId,
        projectId: project._id,
        key: cleanKey,
        value,
        targetEnvironments: envs,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Notification.create({
      userId: session.userId,
      title: "Environment variable saved",
      message: `Configured key "${cleanKey}" on project "${project.name}"`,
      category: "project",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ variable }, { status: 201 });
  } catch (error) {
    console.error("Env vars POST error:", error);
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
    const id = searchParams.get("id");

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Valid variable ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const deleted = await EnvironmentVariable.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Variable not found or access denied" }, { status: 404 });
    }

    await Notification.create({
      userId: session.userId,
      title: "Environment variable removed",
      message: `Removed variable "${deleted.key}"`,
      category: "project",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ message: "Variable deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Env vars DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
