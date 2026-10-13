import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import { getSession } from "@/lib/auth/session";
import { format, subDays, subHours } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d";
    const projectId = searchParams.get("projectId");

    await connectToDatabase();

    const userObjectId = mongoose.isValidObjectId(session.userId)
      ? new mongoose.Types.ObjectId(session.userId)
      : session.userId;
    const userMatch = { $in: [session.userId, userObjectId] };

    // Base deployment match filter strictly scoped to authenticated user
    const deploymentMatch: Record<string, unknown> = { userId: userMatch };
    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
      }
      deploymentMatch.projectId = {
        $in: [projectId, new mongoose.Types.ObjectId(projectId)],
      };
    }

    // Determine time range boundary
    const now = new Date();
    let startDate: Date;
    let isHourly = false;
    let daysCount = 7;

    if (range === "24h") {
      startDate = subHours(now, 24);
      isHourly = true;
    } else if (range === "30d") {
      daysCount = 30;
      startDate = subDays(now, 30);
    } else {
      // Default to 7d
      daysCount = 7;
      startDate = subDays(now, 7);
    }

    // Run parallel aggregation pipelines
    const [
      projectCount,
      statusGroups,
      durationStats,
      timelineAgg,
      frameworkGroups,
    ] = await Promise.all([
      Project.countDocuments({ userId: session.userId }),

      Deployment.aggregate([
        { $match: deploymentMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      Deployment.aggregate([
        {
          $match: {
            ...deploymentMatch,
            duration: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: "$duration" },
            minDuration: { $min: "$duration" },
            maxDuration: { $max: "$duration" },
            count: { $sum: 1 },
          },
        },
      ]),

      Deployment.aggregate([
        {
          $match: {
            ...deploymentMatch,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: isHourly
              ? { $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" } }
              : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ["$status", "READY"] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
            },
          },
        },
      ]),

      Project.aggregate([
        { $match: { userId: userMatch } },
        { $group: { _id: "$framework", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Parse status breakdown
    const statusMap: Record<string, number> = {
      READY: 0,
      FAILED: 0,
      BUILDING: 0,
      QUEUED: 0,
      CANCELED: 0,
    };

    let totalDeployments = 0;
    for (const group of statusGroups) {
      if (group._id && typeof group._id === "string") {
        statusMap[group._id] = group.count;
      }
      totalDeployments += group.count;
    }

    const readyCount = statusMap.READY || 0;
    const failedCount = statusMap.FAILED || 0;
    const buildingCount = statusMap.BUILDING || 0;
    const queuedCount = statusMap.QUEUED || 0;
    const canceledCount = statusMap.CANCELED || 0;
    const inProgressCount = buildingCount + queuedCount;
    const finishedCount = readyCount + failedCount + canceledCount;

    // Zero-division protected success rate calculation
    const successRatePercent =
      finishedCount > 0
        ? Number(((readyCount / (readyCount + failedCount || 1)) * 100).toFixed(1))
        : 0.0;
    const successRate = `${successRatePercent.toFixed(1)}%`;

    // Duration statistics
    const avgDurationSec = durationStats[0]?.avgDuration
      ? Math.round(durationStats[0].avgDuration)
      : 0;
    const minDurationSec = durationStats[0]?.minDuration
      ? Math.round(durationStats[0].minDuration)
      : 0;
    const maxDurationSec = durationStats[0]?.maxDuration
      ? Math.round(durationStats[0].maxDuration)
      : 0;
    const avgBuildTime = avgDurationSec > 0 ? `${avgDurationSec}s` : "0s";

    // Build complete timeline data with zero-filled gaps
    const timelineMap = new Map<string, { total: number; successful: number; failed: number }>();
    for (const item of timelineAgg) {
      timelineMap.set(item._id, {
        total: item.total,
        successful: item.successful,
        failed: item.failed,
      });
    }

    const chartData: Array<{
      date: string;
      time: string;
      deployments: number;
      successful: number;
      failed: number;
    }> = [];

    if (isHourly) {
      for (let i = 23; i >= 0; i--) {
        const d = subHours(now, i);
        const key = format(d, "yyyy-MM-dd HH:00");
        const label = format(d, "HH:00");
        const entry = timelineMap.get(key) || { total: 0, successful: 0, failed: 0 };
        chartData.push({
          date: key,
          time: label,
          deployments: entry.total,
          successful: entry.successful,
          failed: entry.failed,
        });
      }
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, "yyyy-MM-dd");
        const label = format(d, "MMM d");
        const entry = timelineMap.get(key) || { total: 0, successful: 0, failed: 0 };
        chartData.push({
          date: key,
          time: label,
          deployments: entry.total,
          successful: entry.successful,
          failed: entry.failed,
        });
      }
    }

    const frameworks = frameworkGroups.map((f) => ({
      framework: f._id || "Other",
      count: f.count,
    }));

    return NextResponse.json({
      activeProjects: projectCount,
      totalProjects: projectCount,
      totalDeployments,
      successfulDeployments: readyCount,
      failedDeployments: failedCount,
      inProgressDeployments: inProgressCount,
      successRate,
      successRatePercent,
      avgBuildTime,
      avgDurationSeconds: avgDurationSec,
      minDurationSeconds: minDurationSec,
      maxDurationSeconds: maxDurationSec,
      chartData,
      frameworks,
      statusBreakdown: {
        READY: readyCount,
        FAILED: failedCount,
        BUILDING: buildingCount,
        QUEUED: queuedCount,
        CANCELED: canceledCount,
      },
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
