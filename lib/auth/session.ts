import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import mongoose from "mongoose";

const secretKey = process.env.JWT_SECRET || "default_development_secret_key";
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload extends JWTPayload {
  userId: string;
}

export async function encrypt(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const sessionToken = await encrypt({ userId, expires: expires.toISOString() });

  try {
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      expires,
      maxAge: 7 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  } catch {
    // Graceful fallback when cookies() is accessed outside request scope
  }

  return sessionToken;
}

function extractTokenFromRequest(req: Request): string | undefined {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith("session=")) {
          return decodeURIComponent(cookie.substring("session=".length));
        }
      }
    }
  } catch {
    // Ignore extraction errors
  }
  return undefined;
}

export async function getSession(tokenOrReq?: string | Request): Promise<SessionPayload | null> {
  try {
    let token: string | undefined;
    if (typeof tokenOrReq === "string") {
      token = tokenOrReq;
    } else if (tokenOrReq && typeof tokenOrReq === "object" && "headers" in tokenOrReq) {
      token = extractTokenFromRequest(tokenOrReq);
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get("session")?.value;
      } catch {
        // Not in request scope or cookies() unavailable
      }
    }
    if (!token) return null;
    return await decrypt(token);
  } catch {
    return null;
  }
}

export async function requireAuth(tokenOrReq?: string | Request): Promise<string> {
  const session = await getSession(tokenOrReq);
  if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
    throw new Error("Unauthorized");
  }
  return session.userId;
}

export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set("session", "", {
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  } catch {
    // Handled on response object
  }
}
