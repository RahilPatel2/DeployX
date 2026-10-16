import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import Integration from "@/models/Integration";
import Activity from "@/models/Activity";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/auth/rate-limit";

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `account-delete:${session.userId}:${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(5, rateCheck.remaining, rateCheck.retryAfterSeconds),
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password, confirmation } = body;

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Require either password verification or explicit confirmation match
    if (password) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Incorrect password. Account deletion cannot proceed." },
          { status: 400 }
        );
      }
    } else if (confirmation !== "DELETE MY ACCOUNT" && confirmation !== user.username) {
      return NextResponse.json(
        {
          error: "Please provide your account password or type 'DELETE MY ACCOUNT' to confirm deletion.",
        },
        { status: 400 }
      );
    }

    const userId = user._id;

    // 1. Delete associated projects and cascade their sub-resources
    const userProjects = await Project.find({ userId }).select("_id githubWebhookId repository").lean();
    const projectIds = userProjects.map((p) => p._id);

    // Clean up registered GitHub repository webhooks if integration token exists
    const integration = await Integration.findOne({ userId, provider: "github" });
    if (integration?.accessToken) {
      try {
        const { deleteRepositoryWebhook } = await import("@/lib/github/webhook");
        for (const proj of userProjects) {
          if (proj.githubWebhookId && proj.repository) {
            const [owner, repo] = proj.repository.split("/");
            if (owner && repo) {
              await deleteRepositoryWebhook(
                integration.accessToken,
                owner,
                repo,
                proj.githubWebhookId
              ).catch(() => {});
            }
          }
        }
      } catch {
        // Non-critical cleanup
      }
    }

    // 2. Cascade delete projects, deployments, integrations, activities, webhook deliveries, and domains
    await Promise.all([
      Project.deleteMany({ userId }),
      Deployment.deleteMany({ userId }),
      Integration.deleteMany({ userId }),
      Activity.deleteMany({ userId }),
    ]);

    try {
      const WebhookDelivery = (await import("@/models/WebhookDelivery")).default;
      await WebhookDelivery.deleteMany({ projectId: { $in: projectIds } });
    } catch {
      // Ignore if not present
    }

    try {
      const Domain = (await import("@/models/Domain")).default;
      await Domain.deleteMany({ userId });
    } catch {
      // Ignore if not present
    }

    // 3. Remove local avatar file if stored
    if (user.avatar && user.avatar.startsWith("/uploads/avatars/")) {
      try {
        const oldFilename = path.basename(user.avatar);
        const oldFilePath = path.join(process.cwd(), "public", "uploads", "avatars", oldFilename);
        await fs.unlink(oldFilePath).catch(() => {});
      } catch {
        // Ignore file cleanup error
      }
    }

    // 4. Delete the User record
    await User.findByIdAndDelete(userId);

    // 5. Expire session cookie
    const response = NextResponse.json(
      { message: "Account and all associated resources deleted successfully" },
      { status: 200 }
    );

    response.cookies.set({
      name: "session",
      value: "",
      expires: new Date(0),
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("[Account Deletion Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
