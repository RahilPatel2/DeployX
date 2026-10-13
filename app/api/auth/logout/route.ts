import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await clearSession();

    const response = NextResponse.json(
      { success: true, message: "Signed out successfully." },
      { status: 200 }
    );

    // Explicitly append cookie clearing header on the response object
    response.cookies.set("session", "", {
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Auth] Logout POST error:", error);
    // Still clear the cookie even if clearSession had an error
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
    await clearSession();
  } catch (error) {
    console.error("[Auth] Logout GET error:", error);
  }

  const url = new URL("/login", req.url);
  const response = NextResponse.redirect(url);
  response.cookies.set("session", "", {
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return response;
}
