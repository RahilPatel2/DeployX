import { NextResponse } from "next/server";
import { getSession, clearSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const session = await getSession(req).catch(() => null);

    if (session?.userId && session?.sessionId) {
      try {
        await connectToDatabase();
        await User.updateOne(
          { _id: session.userId },
          { $pull: { sessions: { sessionId: session.sessionId } } }
        );
      } catch {
        // Non-critical cleanup
      }
    }

    await clearSession();

    const response = NextResponse.json(
      { success: true, message: "Signed out successfully." },
      { status: 200 }
    );

    // Explicitly append cookie clearing header on the response object
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(0),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("[Auth] Logout POST error:", error);
    const response = NextResponse.json(
      { success: true, message: "Signed out successfully." },
      { status: 200 }
    );
    response.cookies.set("session", "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
    return response;
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession(req).catch(() => null);

    if (session?.userId && session?.sessionId) {
      try {
        await connectToDatabase();
        await User.updateOne(
          { _id: session.userId },
          { $pull: { sessions: { sessionId: session.sessionId } } }
        );
      } catch {
        // Non-critical cleanup
      }
    }

    await clearSession();
  } catch (error) {
    console.error("[Auth] Logout GET error:", error);
  }

  const url = new URL("/login", req.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
