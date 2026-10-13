import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Activity from "@/models/Activity";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");

    await connectToDatabase();

    const query: Record<string, unknown> = { userId: session.userId };

    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return NextResponse.json({
          activities: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
      query.projectId = projectId;
    }

    if (type && type.trim()) {
      const types = type.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        query.type = types[0];
      } else if (types.length > 1) {
        query.type = { $in: types };
      }
    } else if (category) {
      const categoryMap: Record<string, string[]> = {
        projects: ["project_created", "project_updated", "project_deleted"],
        deployments: ["deployment_started", "deployment_ready", "deployment_failed"],
        webhooks: ["webhook_push", "webhook_ping"],
        auth: ["github_connected"],
      };

      if (categoryMap[category]) {
        query.type = { $in: categoryMap[category] };
      }
    }

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .populate({
          path: "projectId",
          model: Project,
          select: "name slug repository branch framework productionUrl",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      activities,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Activity GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
