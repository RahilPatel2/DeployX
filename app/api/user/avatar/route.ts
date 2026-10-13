import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB limit
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  // JPEG: Starts with FF D8 FF
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: Starts with 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WebP: Starts with RIFF and has WEBP at bytes 8-11
  if (mimeType === "image/webp") {
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".png";
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data submission" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Size validation
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "Image file exceeds maximum allowed size of 2MB" },
        { status: 400 }
      );
    }

    // MIME type validation
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    // Buffer and Magic Byte content validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, mimeType)) {
      return NextResponse.json(
        { error: "Corrupted or invalid image content. File signature does not match image format." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Safely delete previous local avatar file if exists
    if (user.avatar && user.avatar.startsWith("/uploads/avatars/")) {
      const oldFilename = path.basename(user.avatar);
      const oldFilePath = path.join(uploadsDir, oldFilename);
      await fs.unlink(oldFilePath).catch(() => {});
    }

    // Generate non-guessable, sanitized filename
    const ext = getExtension(mimeType);
    const randomSuffix = crypto.randomBytes(12).toString("hex");
    const sanitizedFilename = `avatar-${session.userId}-${Date.now()}-${randomSuffix}${ext}`;
    const targetFilePath = path.join(uploadsDir, sanitizedFilename);

    // Save to disk
    await fs.writeFile(targetFilePath, buffer);

    // Persist relative public URL to user record
    const publicUrl = `/uploads/avatars/${sanitizedFilename}`;
    user.avatar = publicUrl;
    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "avatar_updated",
        title: "Avatar updated",
        description: "You uploaded a new profile avatar.",
        icon: "User",
        color: "text-blue-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      {
        message: "Avatar uploaded successfully",
        avatarUrl: publicUrl,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Avatar Upload Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Safely delete avatar file from disk if stored locally
    if (user.avatar && user.avatar.startsWith("/uploads/avatars/")) {
      const oldFilename = path.basename(user.avatar);
      const oldFilePath = path.join(process.cwd(), "public", "uploads", "avatars", oldFilename);
      await fs.unlink(oldFilePath).catch(() => {});
    }

    user.avatar = undefined;
    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "avatar_deleted",
        title: "Avatar removed",
        description: "You removed your profile avatar.",
        icon: "User",
        color: "text-slate-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      { message: "Avatar removed successfully", avatarUrl: null },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Avatar DELETE Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
