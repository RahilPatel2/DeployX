import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const protectedPaths = [
  "/dashboard",
  "/settings",
  "/projects",
  "/deployments",
  "/analytics",
  "/activity",
  "/profile",
  "/domains",
  "/notifications",
  "/environment-variables",
  "/team",
];

export async function proxy(req: NextRequest) {
  const sessionCookie = req.cookies.get("session")?.value;
  let isLoggedIn = false;
  let hasMalformedCookie = false;

  if (sessionCookie) {
    try {
      const secretKey = process.env.JWT_SECRET || "default_development_secret_key";
      const key = new TextEncoder().encode(secretKey);
      await jwtVerify(sessionCookie, key, { algorithms: ["HS256"] });
      isLoggedIn = true;
    } catch {
      isLoggedIn = false;
      hasMalformedCookie = true;
    }
  }

  const { pathname, search } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    const res = NextResponse.next();
    if (hasMalformedCookie) {
      res.cookies.delete("session");
    }
    return res;
  }

  if (!isLoggedIn && isProtected) {
    const redirectUrl = new URL("/login", req.nextUrl);
    const originalPath = pathname + (search ? search : "");
    redirectUrl.searchParams.set("redirect", originalPath);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    if (hasMalformedCookie || sessionCookie) {
      response.cookies.delete("session");
    }
    return response;
  }

  // If logged in and visiting shorthand path (e.g. /projects -> /dashboard/projects)
  if (isLoggedIn && !pathname.startsWith("/dashboard")) {
    if (pathname === "/projects" || pathname.startsWith("/projects/")) {
      return NextResponse.redirect(new URL("/dashboard" + pathname, req.nextUrl));
    }
    if (pathname === "/deployments" || pathname.startsWith("/deployments/")) {
      return NextResponse.redirect(new URL("/dashboard" + pathname, req.nextUrl));
    }
    if (pathname === "/analytics") {
      return NextResponse.redirect(new URL("/dashboard/analytics", req.nextUrl));
    }
    if (pathname === "/activity") {
      return NextResponse.redirect(new URL("/dashboard/activity", req.nextUrl));
    }
    if (pathname === "/profile") {
      return NextResponse.redirect(new URL("/dashboard/settings/profile", req.nextUrl));
    }
    if (pathname === "/domains") {
      return NextResponse.redirect(new URL("/dashboard/domains", req.nextUrl));
    }
    if (pathname === "/notifications") {
      return NextResponse.redirect(new URL("/dashboard/notifications", req.nextUrl));
    }
    if (pathname === "/settings" || pathname.startsWith("/settings/")) {
      return NextResponse.redirect(new URL("/dashboard" + pathname, req.nextUrl));
    }
  }

  const response = NextResponse.next();
  if (isProtected) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
