import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json(
      { message: "Signed out successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
