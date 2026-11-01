import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import { getSession } from "@/lib/auth/session";

interface NavEntry {
  title: string;
  description: string;
  href: string;
  category: "Navigation" | "Settings" | "Action";
  keywords: string[];
}

const ALL_NAVIGATION: NavEntry[] = [
  {
    title: "Dashboard Overview",
    description: "Main workspace metrics, recent builds, and deployment statuses",
    href: "/dashboard",
    category: "Navigation",
    keywords: ["dashboard", "overview", "home", "metrics", "status", "d"],
  },
  {
    title: "Projects",
    description: "View and manage all connected repositories and applications",
    href: "/dashboard/projects",
    category: "Navigation",
    keywords: ["projects", "apps", "repositories", "repos", "p"],
  },
  {
    title: "Create New Project",
    description: "Import a new repository from GitHub and configure deployment",
    href: "/dashboard/projects/new",
    category: "Action",
    keywords: ["create project", "new project", "import", "deploy", "add", "p"],
  },
  {
    title: "Deployments",
    description: "Live build logs, pipeline executions, and deployment histories",
    href: "/dashboard/deployments",
    category: "Navigation",
    keywords: ["deployments", "builds", "pipeline", "history", "logs", "d"],
  },
  {
    title: "Analytics",
    description: "Edge network latency, total requests, and bandwidth statistics",
    href: "/dashboard/analytics",
    category: "Navigation",
    keywords: ["analytics", "metrics", "traffic", "bandwidth", "requests", "charts", "a"],
  },
  {
    title: "Custom Domains",
    description: "Configure DNS records, SSL certificates, and custom apex domains",
    href: "/dashboard/domains",
    category: "Navigation",
    keywords: ["domains", "custom domain", "dns", "ssl", "cname", "d"],
  },
  {
    title: "Environment Variables",
    description: "Manage project secrets, runtime configurations, and API keys",
    href: "/dashboard/environment-variables",
    category: "Navigation",
    keywords: ["environment variables", "env", "secrets", "config", "tokens", "e"],
  },
  {
    title: "Team Members",
    description: "Collaborators, access control, and workspace invitations",
    href: "/dashboard/team",
    category: "Navigation",
    keywords: ["team", "members", "collaborators", "roles", "users", "t"],
  },
  {
    title: "Activity Log",
    description: "Real-time audit events, deployment triggers, and security logs",
    href: "/dashboard/activity",
    category: "Navigation",
    keywords: ["activity", "audit", "events", "history", "log", "a"],
  },
  {
    title: "Notifications",
    description: "System alerts, build status updates, and security notifications",
    href: "/dashboard/notifications",
    category: "Navigation",
    keywords: ["notifications", "alerts", "inbox", "unread", "messages", "n"],
  },
  {
    title: "Account Settings",
    description: "General workspace configuration and profile overview",
    href: "/dashboard/settings",
    category: "Settings",
    keywords: ["settings", "account", "preferences", "config", "s"],
  },
  {
    title: "Edit Profile",
    description: "Display name, username handle, bio, and custom profile photo",
    href: "/dashboard/settings/profile",
    category: "Settings",
    keywords: ["profile", "avatar", "photo", "bio", "username", "name", "email", "p"],
  },
  {
    title: "Security & Sessions",
    description: "Password updates, active devices, and session revocation",
    href: "/dashboard/settings/security",
    category: "Settings",
    keywords: ["security", "password", "sessions", "devices", "sign out", "auth", "s"],
  },
  {
    title: "Appearance",
    description: "Dark mode, light mode, system theme, and default layout views",
    href: "/dashboard/settings/appearance",
    category: "Settings",
    keywords: ["appearance", "theme", "dark", "light", "display", "layout", "a"],
  },
  {
    title: "Billing & Plans",
    description: "Subscription tier, usage quotas, and payment history",
    href: "/dashboard/settings/billing",
    category: "Settings",
    keywords: ["billing", "plan", "subscription", "upgrade", "invoices", "b"],
  },
  {
    title: "API Keys",
    description: "Personal access tokens for the DeployX CLI and external integrations",
    href: "/dashboard/settings/api",
    category: "Settings",
    keywords: ["api keys", "api", "tokens", "access token", "cli", "a"],
  },
  {
    title: "GitHub Integration",
    description: "OAuth connection, repository permissions, and webhook status",
    href: "/dashboard/settings/github",
    category: "Settings",
    keywords: ["github", "git", "oauth", "repositories", "reconnect", "g"],
  },
  {
    title: "Cloudflare Provider",
    description: "Cloudflare Pages API tokens and account credentials",
    href: "/dashboard/settings/cloudflare",
    category: "Settings",
    keywords: ["cloudflare", "pages", "cloudflare provider", "deploy target", "c"],
  },
  {
    title: "Danger Zone",
    description: "Irreversible workspace data deletion and account termination",
    href: "/dashboard/settings/danger-zone",
    category: "Settings",
    keywords: ["danger zone", "delete account", "delete", "destroy", "d"],
  },
];

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    // If query is empty, return popular default destinations and actions
    if (!query) {
      return NextResponse.json({
        navigation: ALL_NAVIGATION.slice(0, 8),
        projects: [],
        deployments: [],
      });
    }

    // 1. Filter Navigation items by title, description, or keyword matching
    const matchedNavigation = ALL_NAVIGATION.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchKeyword = item.keywords.some((kw) => kw.toLowerCase().startsWith(query) || kw.toLowerCase().includes(query));
      return matchTitle || matchDesc || matchKeyword;
    });

    // 2. Fetch matched Projects and Deployments from DB
    await connectToDatabase();

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const queryRegex = new RegExp(escapedQuery, "i");

    const [matchedProjects, matchedDeployments] = await Promise.all([
      Project.find({
        userId: session.userId,
        $or: [
          { name: queryRegex },
          { repository: queryRegex },
          { framework: queryRegex },
        ],
      })
        .select("_id name repository framework productionUrl status")
        .limit(5)
        .lean()
        .catch(() => []),

      Deployment.find({
        userId: session.userId,
        $or: [
          { commitMessage: queryRegex },
          { commitHash: queryRegex },
          { branch: queryRegex },
          { environment: queryRegex },
        ],
      })
        .select("_id projectId status branch commitMessage commitHash url createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(() => []),
    ]);

    interface ProjectSearchDoc {
      _id: { toString(): string };
      name: string;
      repository?: string;
      framework?: string;
      status?: string;
    }

    interface DeploymentSearchDoc {
      _id: { toString(): string };
      projectId?: { toString(): string };
      branch?: string;
      commitMessage?: string;
      commitHash?: string;
      status: string;
      createdAt: Date | string;
    }

    const formattedProjects = ((matchedProjects || []) as unknown as ProjectSearchDoc[]).map((p) => ({
      id: p._id.toString(),
      name: p.name,
      repository: p.repository || "Custom",
      framework: p.framework || "Other",
      url: `/dashboard/projects/${p._id.toString()}`,
      status: p.status || "ready",
    }));

    const formattedDeployments = ((matchedDeployments || []) as unknown as DeploymentSearchDoc[]).map((d) => ({
      id: d._id.toString(),
      projectId: d.projectId?.toString() || "",
      branch: d.branch || "main",
      commitMessage: d.commitMessage || "Manual deployment",
      commitHash: d.commitHash ? d.commitHash.slice(0, 7) : "",
      status: d.status,
      url: `/dashboard/deployments/${d._id.toString()}`,
      createdAt: d.createdAt,
    }));

    return NextResponse.json({
      navigation: matchedNavigation,
      projects: formattedProjects,
      deployments: formattedDeployments,
    });
  } catch (error: unknown) {
    console.error("[Search API Error]:", error);
    // Safe fallback returning empty collections instead of throwing
    return NextResponse.json(
      {
        navigation: [],
        projects: [],
        deployments: [],
      },
      { status: 200 }
    );
  }
}
