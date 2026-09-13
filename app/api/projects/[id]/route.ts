import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";

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
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const project = await Project.findOneAndDelete({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Optional: Log activity
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
