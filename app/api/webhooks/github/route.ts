import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import WebhookDelivery from "@/models/WebhookDelivery";
import Activity from "@/models/Activity";
import { verifyWebhookSignature } from "@/lib/github/webhook";
import { decryptToken } from "@/lib/auth/encryption";

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload ceiling

interface GitHubPushPayload {
  ref?: string;
  before?: string;
  after?: string;
  deleted?: boolean;
  repository?: {
    id?: number;
    name?: string;
    full_name?: string;
  };
  pusher?: {
    name?: string;
  };
  sender?: {
    login?: string;
  };
  head_commit?: {
    id?: string;
    message?: string;
    timestamp?: string;
    author?: {
      name?: string;
    };
  };
}

export async function POST(req: Request) {
  try {
    // 1. Read raw body as text for HMAC verification
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload too large. Exceeds 1MB limit." },
        { status: 413 }
      );
    }

    // 2. Validate GitHub event headers
    const event = req.headers.get("x-github-event");
    const deliveryId = req.headers.get("x-github-delivery");
    const signature = req.headers.get("x-hub-signature-256");

    if (!event || typeof event !== "string" || event.length > 64) {
      return NextResponse.json({ error: "Invalid or missing X-GitHub-Event header" }, { status: 400 });
    }

    if (!deliveryId || typeof deliveryId !== "string" || deliveryId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(deliveryId)) {
      return NextResponse.json({ error: "Invalid or missing X-GitHub-Delivery header" }, { status: 400 });
    }

    // Require signature header on all webhook events
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature header X-Hub-Signature-256" },
        { status: 401 }
      );
    }

    // Safe ignore for unsupported events other than push and ping
    if (event !== "push" && event !== "ping") {
      return NextResponse.json(
        { message: `Event '${event}' safely ignored. DeployX only processes 'push' and 'ping'.`, ignored: true },
        { status: 200 }
      );
    }

    // 3. Parse JSON safely
    let payload: GitHubPushPayload;
    try {
      payload = JSON.parse(rawBody) as GitHubPushPayload;
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    const repoFullName = payload.repository?.full_name?.trim();
    const repoId = payload.repository?.id;

    if (!repoFullName && !repoId) {
      return NextResponse.json(
        { error: "Missing repository information in webhook payload" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 4. Match registered project by repository identity (never trust payload owner ID)
    const project = await Project.findOne({
      $or: [
        { repository: repoFullName },
        ...(repoId ? [{ repositoryId: repoId }] : []),
      ],
    });

    if (!project) {
      return NextResponse.json(
        {
          ignored: true,
          reason: `No DeployX project found associated with repository '${repoFullName || repoId}'.`,
        },
        { status: 404 }
      );
    }

    // 5. Signature verification against project-specific encrypted secret
    if (!project.webhookSecret) {
      return NextResponse.json(
        { error: "Project does not have a configured webhook secret. Please regenerate webhook settings." },
        { status: 401 }
      );
    }

    let secret: string;
    try {
      secret = decryptToken(project.webhookSecret);
    } catch {
      secret = project.webhookSecret;
    }

    const isValidSignature = verifyWebhookSignature(rawBody, signature, secret);
    if (!isValidSignature) {
      project.lastWebhookStatus = "failed";
      project.lastWebhookError = "Invalid HMAC-SHA256 signature";
      await project.save();
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Acknowledge verified ping event from GitHub
    if (event === "ping") {
      project.webhookStatus = "active";
      project.lastWebhookStatus = "success";
      project.lastWebhookPayloadAt = new Date();
      await project.save();
      return NextResponse.json(
        { message: "Ping verified and acknowledged successfully.", deliveryId },
        { status: 200 }
      );
    }

    // 6. Idempotency Check: Prevent duplicate processing of the same delivery ID
    const existingDelivery = await WebhookDelivery.findOne({ deliveryId });
    if (existingDelivery) {
      return NextResponse.json(
        {
          status: "duplicate",
          message: "Delivery has already been received and processed.",
          deliveryId,
          deploymentId: existingDelivery.deploymentId,
        },
        { status: 200 }
      );
    }

    // 7. Ignore deleted branch events
    if (payload.deleted === true || payload.after === "0000000000000000000000000000000000000000") {
      await WebhookDelivery.create({
        deliveryId,
        projectId: project._id,
        repository: repoFullName || project.repository,
        branch: (payload.ref || "").replace(/^refs\/heads\//, ""),
        commitHash: payload.after || "0000000000000000000000000000000000000000",
        event: "push",
        status: "IGNORED",
        ignoredReason: "Branch deletion event",
        payloadSize: rawBody.length,
        processedAt: new Date(),
      });

      return NextResponse.json(
        { ignored: true, reason: "Branch deletion event ignored" },
        { status: 200 }
      );
    }

    // 8. Branch Matching: Ensure push was to the configured production branch
    const pushedBranch = (payload.ref || "").replace(/^refs\/heads\//, "");
    const targetBranch = project.branch || "main";

    if (pushedBranch !== targetBranch) {
      await WebhookDelivery.create({
        deliveryId,
        projectId: project._id,
        repository: repoFullName || project.repository,
        branch: pushedBranch,
        commitHash: payload.head_commit?.id || payload.after || "unknown",
        commitMessage: payload.head_commit?.message?.split("\n")[0],
        event: "push",
        status: "IGNORED",
        ignoredReason: `Pushed branch '${pushedBranch}' does not match project production branch '${targetBranch}'`,
        payloadSize: rawBody.length,
        processedAt: new Date(),
      });

      return NextResponse.json(
        {
          ignored: true,
          reason: `Push to '${pushedBranch}' ignored. Production branch is '${targetBranch}'.`,
        },
        { status: 200 }
      );
    }

    // 9. Automatic Deployments Setting Check
    if (project.autoDeploy === false) {
      await WebhookDelivery.create({
        deliveryId,
        projectId: project._id,
        repository: repoFullName || project.repository,
        branch: pushedBranch,
        commitHash: payload.head_commit?.id || payload.after || "unknown",
        commitMessage: payload.head_commit?.message?.split("\n")[0],
        event: "push",
        status: "IGNORED",
        ignoredReason: "Automatic deployments are disabled for this project",
        payloadSize: rawBody.length,
        processedAt: new Date(),
      });

      return NextResponse.json(
        {
          ignored: true,
          reason: "Automatic deployments are disabled for this project.",
        },
        { status: 200 }
      );
    }

    // 10. Extract exact pushed commit SHA and metadata
    const commitHash = payload.head_commit?.id || payload.after;
    if (!commitHash || commitHash.length < 7) {
      return NextResponse.json(
        { error: "Unable to determine pushed commit SHA from payload" },
        { status: 400 }
      );
    }

    const commitMessage = (payload.head_commit?.message || "").split("\n")[0] || "Automatic deployment from push";
    const commitAuthor = payload.head_commit?.author?.name || payload.pusher?.name || "GitHub Push";
    const commitTimestamp = payload.head_commit?.timestamp
      ? new Date(payload.head_commit.timestamp)
      : new Date();

    // 11. Out-of-Order Push Protection
    // Compare commit timestamp against previous completed or queued deployments for this project & branch
    const priorDelivery = await WebhookDelivery.findOne({
      projectId: project._id,
      branch: pushedBranch,
      status: "COMPLETED",
      commitTimestamp: { $gt: commitTimestamp },
    }).sort({ commitTimestamp: -1 });

    if (priorDelivery) {
      await WebhookDelivery.create({
        deliveryId,
        projectId: project._id,
        repository: repoFullName || project.repository,
        branch: pushedBranch,
        commitHash,
        commitMessage,
        event: "push",
        status: "IGNORED",
        ignoredReason: `Out-of-order push event: a newer commit was already deployed (commit ${priorDelivery.commitHash.slice(0, 7)})`,
        payloadSize: rawBody.length,
        processedAt: new Date(),
      });

      return NextResponse.json(
        {
          ignored: true,
          reason: `Out-of-order push event. A newer commit (${priorDelivery.commitHash.slice(0, 7)}) has already been processed.`,
        },
        { status: 200 }
      );
    }

    // 12. Prevent duplicate concurrent deployment for the exact same project & commit
    const activeDeployment = await Deployment.findOne({
      projectId: project._id,
      commitHash,
      status: { $in: ["QUEUED", "BUILDING"] },
    });

    if (activeDeployment) {
      await WebhookDelivery.create({
        deliveryId,
        projectId: project._id,
        repository: repoFullName || project.repository,
        branch: pushedBranch,
        commitHash,
        commitMessage,
        event: "push",
        status: "COMPLETED",
        deploymentId: activeDeployment._id,
        payloadSize: rawBody.length,
        processedAt: new Date(),
      });

      return NextResponse.json(
        {
          status: "in_progress",
          message: "Deployment for this commit is already in progress.",
          deploymentId: activeDeployment._id,
          deliveryId,
        },
        { status: 200 }
      );
    }

    // 13. Atomically create durable Deployment record
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: project.userId,
      status: "QUEUED",
      branch: targetBranch,
      commitHash,
      commitMessage,
      environment: "production",
      trigger: "webhook",
      startedAt: new Date(),
      buildConfigSnapshot: {
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
        installCommand: project.installCommand,
        rootDirectory: project.rootDirectory,
        framework: project.framework,
      },
      logs: [
        `[DeployX] Automatic deployment triggered via GitHub push on '${targetBranch}'`,
        `[DeployX] GitHub Delivery ID: ${deliveryId}`,
        `[DeployX] Pinned commit ${commitHash.slice(0, 7)}: "${commitMessage}" by ${commitAuthor}`,
      ],
    });

    // 14. Record Webhook Delivery audit record
    await WebhookDelivery.create({
      deliveryId,
      projectId: project._id,
      repository: repoFullName || project.repository,
      branch: pushedBranch,
      commitHash,
      commitMessage,
      sender: payload.sender?.login || commitAuthor,
      event: "push",
      status: "COMPLETED",
      deploymentId: deployment._id,
      commitTimestamp,
      payloadSize: rawBody.length,
      processedAt: new Date(),
    });

    // 15. Update project webhook telemetry
    project.lastWebhookPayloadAt = new Date();
    project.lastWebhookDeliveryId = deliveryId;
    project.lastWebhookStatus = "success";
    project.lastWebhookError = undefined;
    await project.save();

    // 16. Record Activity Audit Log
    try {
      await Activity.create({
        userId: project.userId,
        projectId: project._id,
        type: "deployment_started",
        title: "Automatic deployment triggered",
        description: `Push to '${targetBranch}' triggered deployment #${deployment._id.toString().slice(-6)} for commit ${commitHash.slice(0, 7)}.`,
        icon: "GitCommit",
        color: "text-purple-500",
      });
    } catch {
      // Non-critical
    }

    // 17. Launch build pipeline in durable background runner
    const { runBuildPipeline } = await import("@/lib/build/pipeline");
    runBuildPipeline(deployment._id.toString()).catch((err) => {
      console.error(`Automatic build pipeline background error for ${deployment._id}:`, err);
    });

    // 18. Fast acknowledge (HTTP 202 Accepted)
    return NextResponse.json(
      {
        message: "Deployment queued successfully from GitHub push.",
        deploymentId: deployment._id,
        deliveryId,
        commit: commitHash.slice(0, 7),
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
