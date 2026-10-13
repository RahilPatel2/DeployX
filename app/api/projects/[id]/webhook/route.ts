import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Integration from "@/models/Integration";
import { getSession } from "@/lib/auth/session";
import {
  generateWebhookSecret,
  getWebhookUrl,
  createRepositoryWebhook,
  deleteRepositoryWebhook,
} from "@/lib/github/webhook";
import { encryptToken, decryptToken } from "@/lib/auth/encryption";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await connectToDatabase();
    const project = await Project.findOne({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Ensure project has a webhook secret generated
    if (!project.webhookSecret) {
      const rawSecret = generateWebhookSecret();
      project.webhookSecret = encryptToken(rawSecret);
      project.webhookStatus = project.webhookStatus || "inactive";
      await project.save();
    }

    let plainSecret = "";
    try {
      plainSecret = decryptToken(project.webhookSecret);
    } catch {
      plainSecret = project.webhookSecret;
    }

    const webhookUrl = getWebhookUrl(req);

    return NextResponse.json({
      webhookUrl,
      webhookStatus: project.webhookStatus || "inactive",
      webhookSecret: plainSecret,
      githubWebhookId: project.githubWebhookId,
      autoDeploy: project.autoDeploy ?? true,
      lastWebhookPayloadAt: project.lastWebhookPayloadAt,
      lastWebhookDeliveryId: project.lastWebhookDeliveryId,
      lastWebhookStatus: project.lastWebhookStatus,
      lastWebhookError: project.lastWebhookError,
    });
  } catch (error) {
    console.error("Webhook GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await connectToDatabase();
    const project = await Project.findOne({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const shouldRegenerate = Boolean(body.regenerateSecret);

    // Generate or retrieve secret
    let plainSecret: string;
    if (!project.webhookSecret || shouldRegenerate) {
      plainSecret = generateWebhookSecret();
      project.webhookSecret = encryptToken(plainSecret);
    } else {
      try {
        plainSecret = decryptToken(project.webhookSecret);
      } catch {
        plainSecret = project.webhookSecret;
      }
    }

    const webhookUrl = getWebhookUrl(req);
    const [owner, repo] = (project.repository || "").split("/");

    // Check user's GitHub integration
    const integration = await Integration.findOne({ userId: session.userId, provider: "github" });

    if (!integration || !integration.accessToken || !owner || !repo) {
      // No GitHub token connected: switch to manual setup mode
      project.webhookStatus = "manual";
      await project.save();
      return NextResponse.json({
        status: "manual",
        webhookUrl,
        webhookSecret: plainSecret,
        message: "GitHub integration not connected. Please configure webhook manually in repository settings.",
      });
    }

    // Attempt automatic registration with GitHub
    const regResult = await createRepositoryWebhook(
      integration.accessToken,
      owner,
      repo,
      webhookUrl,
      plainSecret
    );

    if (regResult.status === "active") {
      project.githubWebhookId = regResult.webhookId;
      project.webhookStatus = "active";
      project.lastWebhookError = undefined;
      await project.save();

      return NextResponse.json({
        status: "active",
        webhookId: regResult.webhookId,
        isExisting: regResult.isExisting,
        webhookUrl,
        webhookSecret: plainSecret,
        message: regResult.isExisting
          ? "Existing webhook confirmed and active on GitHub."
          : "Webhook successfully registered on GitHub.",
      });
    } else if (regResult.status === "manual") {
      project.webhookStatus = "manual";
      project.lastWebhookError = regResult.error;
      await project.save();

      return NextResponse.json({
        status: "manual",
        webhookUrl,
        webhookSecret: plainSecret,
        message: regResult.error,
      });
    } else {
      project.webhookStatus = "failed";
      project.lastWebhookError = regResult.error;
      await project.save();

      return NextResponse.json(
        {
          status: "failed",
          error: regResult.error,
          webhookUrl,
          webhookSecret: plainSecret,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Webhook POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await connectToDatabase();
    const project = await Project.findOne({ _id: id, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If a GitHub hook was registered, attempt remote removal
    if (project.githubWebhookId) {
      const integration = await Integration.findOne({ userId: session.userId, provider: "github" });
      const [owner, repo] = (project.repository || "").split("/");
      if (integration?.accessToken && owner && repo) {
        await deleteRepositoryWebhook(
          integration.accessToken,
          owner,
          repo,
          project.githubWebhookId
        ).catch(() => {});
      }
    }

    project.githubWebhookId = undefined;
    project.webhookStatus = "inactive";
    await project.save();

    return NextResponse.json({ message: "Webhook disconnected successfully" });
  } catch (error) {
    console.error("Webhook DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
