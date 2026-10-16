import { NextResponse } from "next/server";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/security/csrf";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getSession(req);
  const sessionId = session?.userId;
  const token = generateCsrfToken(sessionId);

  const response = NextResponse.json(
    {
      csrfToken: token,
    },
    { status: 200 }
  );

  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Accessible by JavaScript client to send in x-csrf-token header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
  });

  return response;
}
