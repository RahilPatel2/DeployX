import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

// Disallow altering internal security/permission fields
const PROTECTED_FIELDS = [
  "_id",
  "id",
  "role",
  "status",
  "passwordHash",
  "emailVerified",
  "createdAt",
  "updatedAt",
  "lastLogin",
];

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId).select("-passwordHash").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Profile GET error]:", errMessage);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return handleProfileUpdate(req);
}

export async function PATCH(req: Request) {
  return handleProfileUpdate(req);
}

async function handleProfileUpdate(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    // Explicitly reject tampering with critical security fields
    for (const field of PROTECTED_FIELDS) {
      if (field in body && field !== "id" && field !== "_id") {
        return NextResponse.json(
          { error: `Modifying protected field '${field}' is strictly prohibited` },
          { status: 403 }
        );
      }
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { name, username, phone, bio, avatar, preferences } = body;

    // Validate Display Name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 64) {
        return NextResponse.json({ error: "Name must be 64 characters or fewer" }, { status: 400 });
      }
      user.name = name.trim();
    }

    // Validate Username & Uniqueness
    if (username !== undefined) {
      if (typeof username !== "string" || !username.trim()) {
        return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
      }
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanUsername)) {
        return NextResponse.json(
          { error: "Username must be 3-32 characters and contain only letters, numbers, hyphens, and underscores" },
          { status: 400 }
        );
      }

      if (cleanUsername !== user.username) {
        const existing = await User.findOne({
          username: cleanUsername,
          _id: { $ne: session.userId },
        });
        if (existing) {
          return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
        }
        user.username = cleanUsername;
      }
    }

    // Validate Phone
    if (phone !== undefined) {
      if (typeof phone === "string") {
        user.phone = phone.trim().slice(0, 32);
      }
    }

    // Validate Bio
    if (bio !== undefined) {
      if (typeof bio === "string") {
        user.bio = bio.trim().slice(0, 500);
      }
    }

    // Validate Avatar URL / Reference
    if (avatar !== undefined) {
      if (avatar === null || avatar === "") {
        user.avatar = undefined;
      } else if (typeof avatar === "string") {
        // Prevent storing huge arbitrary binary data directly in the profile document
        if (avatar.startsWith("data:") && avatar.length > 200000) {
          return NextResponse.json(
            { error: "Avatar data URI too large. Please use the avatar upload endpoint." },
            { status: 400 }
          );
        }
        user.avatar = avatar.trim().slice(0, 2048);
      }
    }

    // Validate Preferences
    if (preferences !== undefined && typeof preferences === "object" && preferences !== null) {
      user.preferences = user.preferences || {};

      if (preferences.theme !== undefined) {
        if (["system", "light", "dark"].includes(preferences.theme)) {
          user.preferences.theme = preferences.theme;
        } else {
          return NextResponse.json({ error: "Invalid theme value (must be system, light, or dark)" }, { status: 400 });
        }
      }

      if (preferences.defaultView !== undefined) {
        if (["grid", "list"].includes(preferences.defaultView)) {
          user.preferences.defaultView = preferences.defaultView;
        } else {
          return NextResponse.json({ error: "Invalid defaultView value (must be grid or list)" }, { status: 400 });
        }
      }

      if (typeof preferences.notifyOnBuildSuccess === "boolean") {
        user.preferences.notifyOnBuildSuccess = preferences.notifyOnBuildSuccess;
      }

      if (typeof preferences.notifyOnBuildFailure === "boolean") {
        user.preferences.notifyOnBuildFailure = preferences.notifyOnBuildFailure;
      }

      if (typeof preferences.notifyOnDeploymentStarted === "boolean") {
        user.preferences.notifyOnDeploymentStarted = preferences.notifyOnDeploymentStarted;
      }

      if (typeof preferences.timezone === "string") {
        user.preferences.timezone = preferences.timezone.slice(0, 64);
      }
    }

    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "profile_updated",
        title: "Profile updated",
        description: `Updated profile details for @${user.username}.`,
        icon: "User",
        color: "text-blue-500",
      });
    } catch {
      // Non-fatal
    }

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return NextResponse.json({ user: safeUser });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Profile Update error]:", errMessage);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
