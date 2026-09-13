import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.JWT_SECRET || "default_development_secret_key";
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encrypt({ userId, expires });

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    return await decrypt(session);
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session || !session.userId) {
    throw new Error("Unauthorized");
  }
  return session.userId as string;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
