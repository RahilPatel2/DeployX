import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";

function parseDeviceName(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown Device";
  const ua = userAgent.toLowerCase();

  let os = "Desktop";
  if (ua.includes("win")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  let browser = "Browser";
  if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";

  return `${os} · ${browser}`;
}

export async function GET(req: Request) {
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

    const currentSessionId = session.sessionId;
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "Web Browser";

    // If user has no sessions array or current session is not in array, register it
    const sessions = Array.isArray(user.sessions) ? [...user.sessions] : [];
    const hasCurrent = sessions.some((s) => s.sessionId === currentSessionId);

    if (currentSessionId && !hasCurrent) {
      const currentEntry = {
        sessionId: currentSessionId,
        userAgent,
        ip: clientIp,
        createdAt: new Date(),
        lastActive: new Date(),
      };
      sessions.push(currentEntry);
      user.sessions = sessions;
      await user.save();
    }

    // Format sessions for safe UI presentation
    const formattedSessions = sessions.map((s) => ({
      id: s.sessionId,
      isCurrent: s.sessionId === currentSessionId,
      device: parseDeviceName(s.userAgent),
      ip: s.ip || clientIp,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
    }));

    return NextResponse.json(
      {
        sessions: formattedSessions,
        passwordChangedAt: user.passwordChangedAt || null,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt,
        hasPassword: Boolean(user.passwordHash),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Sessions GET Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
