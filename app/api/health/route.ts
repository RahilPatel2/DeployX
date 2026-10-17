import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import { ANTI_CACHE_HEADERS } from "@/lib/security/headers";

/**
 * Health Check & Deployment Liveness Endpoint
 * 
 * Provides automated load-balancer and container orchestrator health checks.
 * Returns safe system metrics and database connectivity status without exposing
 * internal connection strings, credentials, or environment secrets.
 */
export async function GET() {
  const uptime = Math.floor(process.uptime());
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || "development";

  // Check database readiness (1 = connected, 2 = connecting, 0 = disconnected)
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectToDatabase();
    } catch {
      // Graceful fallback to report degraded status without throwing unhandled exceptions
    }
  }

  let dbStatus: "connected" | "connecting" | "disconnected" = "disconnected";
  const readyState = mongoose.connection.readyState;

  if (readyState === 1) {
    dbStatus = "connected";
  } else if (readyState === 2) {
    dbStatus = "connecting";
  }

  const isHealthy = dbStatus === "connected" || dbStatus === "connecting";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp,
      uptime,
      version: "0.1.0",
      environment,
      services: {
        database: dbStatus,
        deploymentProvider: "cloudflare-pages",
      },
    },
    {
      status: statusCode,
      headers: ANTI_CACHE_HEADERS,
    }
  );
}
