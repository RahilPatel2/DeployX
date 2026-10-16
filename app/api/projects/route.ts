import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Integration from "@/models/Integration";
import { getSession } from "@/lib/auth/session";
import { decryptToken } from "@/lib/auth/encryption";
import { CloudflareProvider } from "@/lib/cloudflare/provider";

import { escapeRegex, sanitizeSearchTerm, parsePagination, parseSort } from "@/lib/security/sanitize";

import Deployment from "@/models/Deployment";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search");
    const sanitizedSearch = sanitizeSearchTerm(rawSearch, 80);
    const framework = searchParams.get("framework");

    const { page, limit, skip } = parsePagination(searchParams, 20, 100);
    const { sortObject } = parseSort(searchParams, ["createdAt", "updatedAt", "name"] as const, "createdAt", "desc");

    await connectToDatabase();

    const query: Record<string, unknown> = { userId: session.userId };

    if (sanitizedSearch) {
      const escaped = escapeRegex(sanitizedSearch);
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { repository: { $regex: escaped, $options: "i" } },
        { slug: { $regex: escaped, $options: "i" } },
      ];
    }

    if (framework && framework !== "all") {
      const sanitizedFramework = sanitizeSearchTerm(framework, 32);
      query.framework = { $regex: `^${escapeRegex(sanitizedFramework)}$`, $options: "i" };
    }

    // Fetch projects scoped strictly to the authenticated user
    const [rawProjects, total] = await Promise.all([
      Project.find(query)
        .select("-webhookSecret")
        .sort(sortObject)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(query),
    ]);

    // Attach latest deployment for each project on this page
    const projectIds = rawProjects.map((p) => p._id);
    const latestDeploymentsAgg = projectIds.length > 0
      ? await Deployment.aggregate([
          { $match: { projectId: { $in: projectIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$projectId",
              latestDeployment: {
                $first: {
                  _id: "$_id",
                  status: "$status",
                  duration: "$duration",
                  environment: "$environment",
                  branch: "$branch",
                  commitHash: "$commitHash",
                  commitMessage: "$commitMessage",
                  url: "$url",
                  createdAt: "$createdAt",
                  updatedAt: "$updatedAt",
                  errorMessage: "$errorMessage",
                },
              },
              readyUrls: {
                $push: {
                  $cond: [
                    { $and: [{ $eq: ["$status", "READY"] }, { $ne: ["$url", null] }] },
                    "$url",
                    "$$REMOVE",
                  ],
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const latestDepMap = new Map<
      string,
      { latest: Record<string, unknown>; readyUrl?: string; count: number }
    >();
    for (const item of latestDeploymentsAgg) {
      latestDepMap.set(String(item._id), {
        latest: item.latestDeployment,
        readyUrl: Array.isArray(item.readyUrls) && item.readyUrls.length > 0 ? item.readyUrls[0] : undefined,
        count: item.count,
      });
    }

    const projects = rawProjects.map((proj) => {
      const depInfo = latestDepMap.get(String(proj._id));
      const latest = depInfo?.latest as {
        _id?: unknown;
        status?: string;
        duration?: number;
        environment?: string;
        branch?: string;
        commitHash?: string;
        commitMessage?: string;
        url?: string;
        createdAt?: Date;
      } | undefined;

      const latestReadyUrl = depInfo?.readyUrl;

      return {
        ...proj,
        deploymentCount: depInfo?.count || 0,
        latestDeployment: latest
          ? {
              _id: latest._id,
              status: latest.status,
              duration: latest.duration,
              environment: latest.environment,
              branch: latest.branch,
              commitHash: latest.commitHash,
              commitMessage: latest.commitMessage,
              url: latest.url,
              createdAt: latest.createdAt,
            }
          : null,
        // Computed status for UI badge
        status: latest?.status ? latest.status.toLowerCase() : "no_deployments",
        // Fallback to latest ready deployment live URL if project productionUrl is unset
        liveUrl: proj.productionUrl || latestReadyUrl || (latest?.status === "READY" ? latest.url : undefined),
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      projects,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Projects GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      repository,
      branch,
      framework,
      buildCommand,
      outputDirectory,
      installCommand,
      rootDirectory,
      packageManager,
      deploymentMode,
    } = body;

    const validPackageManagers = ["npm", "pnpm", "yarn", "bun"];
    const sanitizedPackageManager = validPackageManagers.includes(packageManager) ? packageManager : "npm";
    const validDeploymentModes = ["static", "ssr"];
    const sanitizedDeploymentMode = validDeploymentModes.includes(deploymentMode) ? deploymentMode : "static";
    const { sanitizeRootDirectory } = await import("@/lib/github/framework");
    const sanitizedRootDirectory = sanitizeRootDirectory(rootDirectory);

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    if (!repository || typeof repository !== "string" || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repository.trim())) {
      return NextResponse.json({ error: "Valid repository in 'owner/repo' format is required" }, { status: 400 });
    }

    const cleanRepo = repository.trim();
    const cleanRepoPath = cleanRepo.split("/").map(encodeURIComponent).join("/");

    await connectToDatabase();

    // 1. Verify user's connected GitHub integration
    const integration = await Integration.findOne({ userId: session.userId, provider: "github" });
    if (!integration) {
      return NextResponse.json(
        { error: "GitHub account not connected. Please connect your GitHub account to import repositories." },
        { status: 400 }
      );
    }

    let token: string;
    try {
      token = decryptToken(integration.accessToken);
    } catch {
      return NextResponse.json(
        { error: "Could not decrypt GitHub credentials. Please reconnect your account." },
        { status: 401 }
      );
    }

    // 2. Revalidate repository access on GitHub's API server-side
    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepoPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
    });

    if (!repoRes.ok) {
      if (repoRes.status === 404 || repoRes.status === 403) {
        return NextResponse.json(
          { error: `Repository '${cleanRepo}' does not exist or your GitHub account lacks access to it.` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `GitHub verification failed: ${repoRes.statusText}` },
        { status: repoRes.status }
      );
    }

    const repoData = await repoRes.json();
    const repoId = repoData.id;
    const repoOwner = repoData.owner?.login || cleanRepo.split("/")[0];
    const repoName = repoData.name || cleanRepo.split("/")[1];
    const repoVisibility = repoData.private ? "private" : "public";
    const defaultBranch = repoData.default_branch || "main";

    const targetBranch = branch && typeof branch === "string" ? branch.trim() : defaultBranch;

    // 3. Revalidate that the chosen branch exists in this repository
    const branchRes = await fetch(
      `https://api.github.com/repos/${cleanRepoPath}/branches/${encodeURIComponent(targetBranch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DeployX-Platform",
        },
      }
    );

    if (!branchRes.ok) {
      return NextResponse.json(
        { error: `Branch '${targetBranch}' does not exist in repository '${cleanRepo}'. Please select a valid branch.` },
        { status: 400 }
      );
    }

    // 4. Duplicate project check for this user
    const existingProject = await Project.findOne({
      userId: session.userId,
      repository: repoData.full_name,
    });

    if (existingProject) {
      return NextResponse.json(
        {
          error: `A project for repository '${repoData.full_name}' already exists in your workspace ('${existingProject.name}').`,
          existingProjectId: existingProject._id,
        },
        { status: 409 }
      );
    }

    // 5. Generate unique slug
    const cleanName = name.trim();
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const slug = `${baseSlug}-${randomSuffix}`;
    const cloudflareProjectName = slug;

    // Attempt to register Cloudflare Pages project
    try {
      await CloudflareProvider.createProject(
        cloudflareProjectName,
        targetBranch,
        repoData.full_name,
        buildCommand || "npm run build",
        outputDirectory || ".next",
        sanitizedRootDirectory
      );
    } catch (cfError: unknown) {
      const errMsg = cfError instanceof Error ? cfError.message : "Unknown error";
      console.warn("Cloudflare Pages project registration note:", errMsg);
    }

    // 5.5 Generate webhook secret & attempt automatic webhook registration
    const { generateWebhookSecret, getWebhookUrl, createRepositoryWebhook } = await import("@/lib/github/webhook");
    const { encryptToken } = await import("@/lib/auth/encryption");
    const rawWebhookSecret = generateWebhookSecret();
    const encryptedWebhookSecret = encryptToken(rawWebhookSecret);

    let githubWebhookId: number | undefined;
    let webhookStatus: "active" | "inactive" | "manual" | "failed" = "inactive";

    if (integration.accessToken && repoOwner && repoName) {
      try {
        const webhookUrl = getWebhookUrl(req);
        const reg = await createRepositoryWebhook(
          integration.accessToken,
          repoOwner,
          repoName,
          webhookUrl,
          rawWebhookSecret
        );
        webhookStatus = reg.status;
        githubWebhookId = reg.webhookId;
      } catch (hookErr) {
        console.warn("GitHub webhook auto-registration note:", hookErr);
        webhookStatus = "manual";
      }
    }

    // 6. Create the project in MongoDB Atlas
    const project = await Project.create({
      name: cleanName,
      slug,
      userId: session.userId,
      repository: repoData.full_name,
      repositoryId: repoId,
      repositoryOwner: repoOwner,
      repositoryName: repoName,
      repositoryVisibility: repoVisibility,
      defaultBranch,
      branch: targetBranch,
      rootDirectory: sanitizedRootDirectory,
      packageManager: sanitizedPackageManager,
      deploymentMode: sanitizedDeploymentMode,
      framework: framework || "Next.js",
      buildCommand: buildCommand || "npm run build",
      outputDirectory: outputDirectory || ".next",
      installCommand: installCommand || "npm install",
      cloudflareProjectName,
      autoDeploy: true,
      webhookSecret: encryptedWebhookSecret,
      githubWebhookId,
      webhookStatus,
      // Do not create a fake live URL; productionUrl will be populated after real deployment
      productionUrl: undefined,
    });

    // 7. Record activity audit log
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      projectId: project._id,
      type: "project_created",
      title: "Project created",
      description: `Created project '${project.name}' linked to GitHub repository '${repoData.full_name}' (branch '${targetBranch}').`,
      icon: "Box",
      color: "text-blue-500",
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Projects POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
