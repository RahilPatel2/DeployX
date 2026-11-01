import { NextResponse } from "next/server";
import crypto from "crypto";
import connectToDatabase from "@/lib/mongodb/client";
import ApiKey from "@/models/ApiKey";
import Notification from "@/models/Notification";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const keys = await ApiKey.find({ userId: session.userId })
      .select("_id name prefix lastUsedAt expiresAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("API Keys GET error:", error);
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
    const { name, expirationDays } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    const cleanName = name.trim().slice(0, 64);
    const rawKey = `dx_live_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const prefix = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;

    let expiresAt: Date | undefined;
    if (expirationDays && typeof expirationDays === "number" && expirationDays > 0) {
      expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    }

    await connectToDatabase();

    const created = await ApiKey.create({
      userId: session.userId,
      name: cleanName,
      prefix,
      keyHash,
      expiresAt,
    });

    await Notification.create({
      userId: session.userId,
      title: "API key generated",
      message: `Generated new API key "${cleanName}"`,
      category: "security",
      read: false,
    }).catch(() => {});

    return NextResponse.json(
      {
        rawKey,
        key: {
          _id: created._id,
          name: created.name,
          prefix: created.prefix,
          expiresAt: created.expiresAt,
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("API Keys POST error:", error);
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

    if (!id) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const deleted = await ApiKey.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await Notification.create({
      userId: session.userId,
      title: "API key revoked",
      message: `Revoked API key "${deleted.name}"`,
      category: "security",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ message: "API key revoked successfully" }, { status: 200 });
  } catch (error) {
    console.error("API Keys DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
