import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(req: NextRequest) {
  const sessionCookie = req.cookies.get("session")?.value;
  let isLoggedIn = false;

  if (sessionCookie) {
    try {
      const secretKey = process.env.JWT_SECRET || "default_development_secret_key";
      const key = new TextEncoder().encode(secretKey);
      await jwtVerify(sessionCookie, key, { algorithms: ["HS256"] });
      isLoggedIn = true;
    } catch {
      isLoggedIn = false;
    }
  }

  const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/signup');
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/settings');

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn && isDashboard) {
    const redirectUrl = new URL('/login', req.nextUrl);
    const originalPath = req.nextUrl.pathname + (req.nextUrl.search ? req.nextUrl.search : '');
    redirectUrl.searchParams.set('redirect', originalPath);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
