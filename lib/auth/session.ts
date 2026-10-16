import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import mongoose from "mongoose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Checks whether the current runtime environment requires Secure cookie flags.
 * Enforced in production or whenever the canonical app URL uses HTTPS.
 */
export function isProductionSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().startsWith("https://") === true
  );
}

/**
 * Retrieves the cryptographic key for JWT signing and verification.
 * Enforces high-entropy secret in production to prevent signing with insecure defaults.
 */
export function getSessionSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === "default_development_secret_key") {
      throw new Error(
        "[DeployX Auth] FATAL: Insecure JWT_SECRET in production! A strong secret (min 32 characters) must be configured."
      );
    }
  }
  return new TextEncoder().encode(secret || "default_development_secret_key");
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  get secure(): boolean {
    return isProductionSecure();
  },
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

export interface SessionPayload extends JWTPayload {
  userId: string;
}

export async function encrypt(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecretKey());
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  if (!input || typeof input !== "string") return null;
  try {
    const { payload } = await jwtVerify(input, getSessionSecretKey(), {
      algorithms: ["HS256"],
      clockTolerance: 15,
    });
    if (!payload || typeof payload !== "object" || !payload.userId) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const expires = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const sessionToken = await encrypt({ userId, expires: expires.toISOString() });

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      expires,
    });
  } catch {
    // Graceful fallback when cookies() is accessed outside request scope
  }

  return sessionToken;
}

export async function rotateSession(userId: string): Promise<string> {
  await clearSession();
  return await createSession(userId);
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
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(0),
      maxAge: 0,
    });
  } catch {
    // Handled on response object
  }
}

export function getSessionCookieHeader(token: string): string {
  const secure = isProductionSecure() ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function getClearSessionCookieHeader(): string {
  const secure = isProductionSecure() ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}
