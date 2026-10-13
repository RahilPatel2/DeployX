import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { verifyCloudflareConfiguration } from "@/lib/cloudflare/provider";

export async function GET(req: Request) {
  try {
    await requireAuth(req);

    const diagnostics = await verifyCloudflareConfiguration();

    return NextResponse.json(diagnostics);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Cloudflare verification status route error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate Cloudflare configuration." },
      { status: 500 }
    );
  }
}
