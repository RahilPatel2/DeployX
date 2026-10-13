import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User, { IUserPreferences } from "@/models/User";
import { getSession } from "@/lib/auth/session";

const DEFAULT_PREFERENCES: IUserPreferences = {
  theme: "dark",
  defaultView: "grid",
  notifyOnBuildSuccess: true,
  notifyOnBuildFailure: true,
  notifyOnDeploymentStarted: false,
  timezone: "UTC",
};

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId).select("preferences").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(user.preferences || {}),
    };

    return NextResponse.json({ preferences });
  } catch (error: unknown) {
    console.error("[Preferences GET Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return handleUpdatePreferences(req);
}

export async function PATCH(req: Request) {
  return handleUpdatePreferences(req);
}

async function handleUpdatePreferences(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    user.preferences = user.preferences || { ...DEFAULT_PREFERENCES };

    if (body.theme !== undefined) {
      if (["system", "light", "dark"].includes(body.theme)) {
        user.preferences.theme = body.theme;
      } else {
        return NextResponse.json(
          { error: "Invalid theme. Must be 'system', 'light', or 'dark'" },
          { status: 400 }
        );
      }
    }

    if (body.defaultView !== undefined) {
      if (["grid", "list"].includes(body.defaultView)) {
        user.preferences.defaultView = body.defaultView;
      } else {
        return NextResponse.json(
          { error: "Invalid defaultView. Must be 'grid' or 'list'" },
          { status: 400 }
        );
      }
    }

    if (typeof body.notifyOnBuildSuccess === "boolean") {
      user.preferences.notifyOnBuildSuccess = body.notifyOnBuildSuccess;
    }

    if (typeof body.notifyOnBuildFailure === "boolean") {
      user.preferences.notifyOnBuildFailure = body.notifyOnBuildFailure;
    }

    if (typeof body.notifyOnDeploymentStarted === "boolean") {
      user.preferences.notifyOnDeploymentStarted = body.notifyOnDeploymentStarted;
    }

    if (typeof body.timezone === "string") {
      user.preferences.timezone = body.timezone.trim().slice(0, 64);
    }

    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "preferences_updated",
        title: "Preferences saved",
        description: "You updated your workspace preferences and notification settings.",
        icon: "Settings",
        color: "text-purple-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      message: "Preferences updated successfully",
      preferences: user.preferences,
    });
  } catch (error: unknown) {
    console.error("[Preferences Update Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
