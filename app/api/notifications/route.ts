import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Notification from "@/models/Notification";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const category = searchParams.get("category");
    const unreadOnly = searchParams.get("unread") === "true";
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const filter: Record<string, unknown> = { userId: session.userId };
    if (category && ["deployment", "security", "system", "project"].includes(category)) {
      filter.category = category;
    }
    if (unreadOnly) {
      filter.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: session.userId, read: false }),
    ]);

    return NextResponse.json(
      {
        notifications,
        total,
        unreadCount,
        page,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Mark all as read for the authenticated user
    await Notification.updateMany({ userId: session.userId, read: false }, { $set: { read: true } });

    return NextResponse.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    console.error("Notifications PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.id || !mongoose.isValidObjectId(body.id)) {
      return NextResponse.json({ error: "Valid notification ID is required" }, { status: 400 });
    }

    const read = body.read !== undefined ? Boolean(body.read) : true;

    await connectToDatabase();

    const updated = await Notification.findOneAndUpdate(
      { _id: body.id, userId: session.userId },
      { $set: { read } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearRead = searchParams.get("clearRead") === "true";

    await connectToDatabase();

    if (id) {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
      }
      await Notification.deleteOne({ _id: id, userId: session.userId });
      return NextResponse.json({ success: true, message: "Notification deleted." });
    }

    if (clearRead) {
      await Notification.deleteMany({ userId: session.userId, read: true });
      return NextResponse.json({ success: true, message: "All read notifications cleared." });
    }

    return NextResponse.json({ error: "Invalid delete parameters" }, { status: 400 });
  } catch (error) {
    console.error("Notifications DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
