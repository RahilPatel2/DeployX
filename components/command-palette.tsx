"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Settings,
  Plus,
  TerminalSquare,
  Globe,
  User,
  Bell,
  LogOut,
  Shield,
  Palette,
  CreditCard,
  Code,
  GitFork,
  Cloud,
  AlertTriangle,
  ExternalLink,
  Search,
  X,
  KeyRound,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface ProjectSearchResult {
  id: string;
  name: string;
  repository: string;
  framework: string;
  url: string;
  status: string;
}

interface DeploymentSearchResult {
  id: string;
  projectId: string;
  branch: string;
  commitMessage: string;
  commitHash: string;
  status: string;
  url: string;
  createdAt: string;
}

interface NavSearchResult {
  title: string;
  description: string;
  href: string;
  category: "Navigation" | "Settings" | "Action";
  keywords: string[];
}

// In-memory LRU search cache (capped at 50 queries)
const SEARCH_LRU_CACHE = new Map<
  string,
  { projects: ProjectSearchResult[]; deployments: DeploymentSearchResult[] }
>();
const MAX_SEARCH_CACHE_SIZE = 50;

const STATIC_NAV_ITEMS: NavSearchResult[] = [
  {
    title: "Dashboard Overview",
    description: "Main workspace metrics and recent deployments",
    href: "/dashboard",
    category: "Navigation",
    keywords: ["dashboard", "overview", "home", "metrics", "d"],
  },
  {
    title: "Projects",
    description: "Manage connected applications and repositories",
    href: "/dashboard/projects",
    category: "Navigation",
    keywords: ["projects", "apps", "repositories", "p"],
  },
  {
    title: "Create Project",
    description: "Import a new repository from GitHub",
    href: "/dashboard/projects/new",
    category: "Action",
    keywords: ["create project", "new project", "import", "deploy", "p"],
  },
  {
    title: "Deployments",
    description: "Build history and live deployment logs",
    href: "/dashboard/deployments",
    category: "Navigation",
    keywords: ["deployments", "builds", "history", "logs", "d"],
  },
  {
    title: "Analytics",
    description: "Bandwidth usage and edge performance metrics",
    href: "/dashboard/analytics",
    category: "Navigation",
    keywords: ["analytics", "traffic", "metrics", "bandwidth", "charts", "a"],
  },
  {
    title: "Custom Domains",
    description: "DNS records and custom domain configurations",
    href: "/dashboard/domains",
    category: "Navigation",
    keywords: ["domains", "custom domains", "dns", "ssl", "d"],
  },
  {
    title: "Environment Variables",
    description: "Manage project secrets and build configurations",
    href: "/dashboard/environment-variables",
    category: "Navigation",
    keywords: ["environment variables", "env", "secrets", "tokens", "e"],
  },
  {
    title: "Team Members",
    description: "Workspace collaborators and permissions",
    href: "/dashboard/team",
    category: "Navigation",
    keywords: ["team", "members", "collaborators", "roles", "t"],
  },
  {
    title: "Activity Log",
    description: "Audit trail and deployment activity history",
    href: "/dashboard/activity",
    category: "Navigation",
    keywords: ["activity", "audit", "events", "history", "a"],
  },
  {
    title: "Notifications",
    description: "Alerts, build status, and security notices",
    href: "/dashboard/notifications",
    category: "Navigation",
    keywords: ["notifications", "alerts", "inbox", "n"],
  },
  {
    title: "Account Settings",
    description: "General workspace preferences and settings overview",
    href: "/dashboard/settings",
    category: "Settings",
    keywords: ["settings", "account", "preferences", "s"],
  },
  {
    title: "Edit Profile",
    description: "Display name, username, bio, and avatar photo",
    href: "/dashboard/settings/profile",
    category: "Settings",
    keywords: ["profile", "edit profile", "avatar", "bio", "username", "name", "email", "p"],
  },
  {
    title: "Security & Sessions",
    description: "Password change, active sessions, and devices",
    href: "/dashboard/settings/security",
    category: "Settings",
    keywords: ["security", "password", "sessions", "devices", "auth", "s"],
  },
  {
    title: "Appearance",
    description: "Theme color scheme and default project layout views",
    href: "/dashboard/settings/appearance",
    category: "Settings",
    keywords: ["appearance", "theme", "dark", "light", "display", "a"],
  },
  {
    title: "Billing & Plans",
    description: "Subscription tier and resource usage",
    href: "/dashboard/settings/billing",
    category: "Settings",
    keywords: ["billing", "plan", "subscription", "usage", "b"],
  },
  {
    title: "API Keys",
    description: "Personal access tokens for CLI and integrations",
    href: "/dashboard/settings/api",
    category: "Settings",
    keywords: ["api keys", "tokens", "cli", "credentials", "a"],
  },
  {
    title: "GitHub Integration",
    description: "Connected GitHub account and repository sync",
    href: "/dashboard/settings/github",
    category: "Settings",
    keywords: ["github", "git", "repositories", "oauth", "g"],
  },
  {
    title: "Cloudflare Provider",
    description: "Cloudflare Pages API tokens and account binding",
    href: "/dashboard/settings/cloudflare",
    category: "Settings",
    keywords: ["cloudflare", "pages", "tokens", "c"],
  },
  {
    title: "Danger Zone",
    description: "Account deletion and resource purging",
    href: "/dashboard/settings/danger-zone",
    category: "Settings",
    keywords: ["danger zone", "delete account", "delete", "destroy", "d"],
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchingRemote, setSearchingRemote] = React.useState(false);

  const [remoteProjects, setRemoteProjects] = React.useState<ProjectSearchResult[]>([]);
  const [remoteDeployments, setRemoteDeployments] = React.useState<DeploymentSearchResult[]>([]);
  const latestQueryIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Keyboard shortcut listener (⌘K / Ctrl+K) and custom event trigger
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleOpenCustomEvent = () => setOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("deployx-open-search", handleOpenCustomEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("deployx-open-search", handleOpenCustomEvent);
    };
  }, []);

  // Debounced network search with LRU in-memory cache & AbortController
  React.useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      const resetTimer = setTimeout(() => {
        setRemoteProjects([]);
        setRemoteDeployments([]);
        setSearchingRemote(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    // 1. Check in-memory LRU cache first for instant 0ms retrieval
    const cachedResults = SEARCH_LRU_CACHE.get(trimmed);
    if (cachedResults) {
      setRemoteProjects(cachedResults.projects);
      setRemoteDeployments(cachedResults.deployments);
      setSearchingRemote(false);
      return;
    }

    // 2. Abort previous in-flight request if user is still typing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentQueryId = ++latestQueryIdRef.current;
    const startTimer = setTimeout(() => {
      setSearchingRemote(true);
    }, 0);

    const debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search request failed");
        const data = await res.json();

        // Prevent race conditions: ignore if newer query was initiated
        if (currentQueryId === latestQueryIdRef.current) {
          const projects = Array.isArray(data.projects) ? data.projects : [];
          const deployments = Array.isArray(data.deployments) ? data.deployments : [];

          // Store in LRU cache
          if (SEARCH_LRU_CACHE.size >= MAX_SEARCH_CACHE_SIZE) {
            const firstKey = SEARCH_LRU_CACHE.keys().next().value;
            if (firstKey) SEARCH_LRU_CACHE.delete(firstKey);
          }
          SEARCH_LRU_CACHE.set(trimmed, { projects, deployments });

          setRemoteProjects(projects);
          setRemoteDeployments(deployments);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          return; // Ignore aborted requests cleanly
        }
        if (currentQueryId === latestQueryIdRef.current) {
          setRemoteProjects([]);
          setRemoteDeployments([]);
        }
      } finally {
        if (currentQueryId === latestQueryIdRef.current) {
          setSearchingRemote(false);
        }
      }
    }, 120);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query]);

  const runCommand = React.useCallback(
    (action: () => void) => {
      setOpen(false);
      setQuery("");
      action();
    },
    []
  );

  // Client-side instant navigation filtering
  const filteredNav = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATIC_NAV_ITEMS.slice(0, 8);

    return STATIC_NAV_ITEMS.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const descMatch = item.description.toLowerCase().includes(q);
      const keywordMatch = item.keywords.some((kw) => kw.toLowerCase().startsWith(q) || kw.toLowerCase().includes(q));
      return titleMatch || descMatch || keywordMatch;
    });
  }, [query]);

  const getNavIcon = (item: NavSearchResult) => {
    switch (item.href) {
      case "/dashboard": return <LayoutDashboard className="h-4 w-4 text-primary" />;
      case "/dashboard/projects": return <FolderKanban className="h-4 w-4 text-emerald-500" />;
      case "/dashboard/projects/new": return <Plus className="h-4 w-4 text-emerald-500" />;
      case "/dashboard/deployments": return <TerminalSquare className="h-4 w-4 text-blue-500" />;
      case "/dashboard/analytics": return <Activity className="h-4 w-4 text-purple-500" />;
      case "/dashboard/domains": return <Globe className="h-4 w-4 text-cyan-500" />;
      case "/dashboard/environment-variables": return <KeyRound className="h-4 w-4 text-amber-500" />;
      case "/dashboard/team": return <User className="h-4 w-4 text-indigo-500" />;
      case "/dashboard/notifications": return <Bell className="h-4 w-4 text-amber-500" />;
      case "/dashboard/settings": return <Settings className="h-4 w-4 text-muted-foreground" />;
      case "/dashboard/settings/profile": return <User className="h-4 w-4 text-primary" />;
      case "/dashboard/settings/security": return <Shield className="h-4 w-4 text-emerald-500" />;
      case "/dashboard/settings/appearance": return <Palette className="h-4 w-4 text-amber-500" />;
      case "/dashboard/settings/billing": return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      case "/dashboard/settings/api": return <Code className="h-4 w-4 text-blue-500" />;
      case "/dashboard/settings/github": return <GitFork className="h-4 w-4 text-muted-foreground" />;
      case "/dashboard/settings/cloudflare": return <Cloud className="h-4 w-4 text-amber-500" />;
      case "/dashboard/settings/danger-zone": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const hasAnyResults =
    filteredNav.length > 0 || remoteProjects.length > 0 || remoteDeployments.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) setQuery("");
      }}
    >
      <div className="relative border-b border-border/40">
        <CommandInput
          placeholder="Search projects, deployments, settings, or routes... (e.g. 'Projects', 'Security')"
          value={query}
          onValueChange={setQuery}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <CommandList>
        {!hasAnyResults && !searchingRemote && (
          <CommandEmpty>
            <div className="py-6 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
              <p className="font-semibold text-sm text-foreground">No results found for &quot;{query}&quot;</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for &quot;Projects&quot;, &quot;Deployments&quot;, &quot;Settings&quot;, or &quot;Domains&quot;.
              </p>
            </div>
          </CommandEmpty>
        )}

        {/* 1. Projects Section */}
        {remoteProjects.length > 0 && (
          <CommandGroup heading="Projects">
            {remoteProjects.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => runCommand(() => router.push(project.url))}
              >
                <FolderKanban className="h-4 w-4 text-emerald-500 mr-2 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate text-foreground">{project.name}</span>
                  <span className="text-[11px] text-muted-foreground truncate font-mono">
                    {project.repository} • {project.framework}
                  </span>
                </div>
                <ExternalLink className="ml-auto h-3 w-3 opacity-40 shrink-0" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 2. Deployments Section */}
        {remoteDeployments.length > 0 && (
          <>
            {remoteProjects.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Deployments">
              {remoteDeployments.map((deployment) => (
                <CommandItem
                  key={deployment.id}
                  onSelect={() => runCommand(() => router.push(deployment.url))}
                >
                  <TerminalSquare className="h-4 w-4 text-blue-500 mr-2 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate text-foreground">
                      {deployment.commitMessage}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate font-mono">
                      Branch: {deployment.branch} • SHA: {deployment.commitHash || "latest"} • Status:{" "}
                      {deployment.status}
                    </span>
                  </div>
                  <span
                    className={`ml-auto text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      deployment.status === "READY"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : deployment.status === "FAILED"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    {deployment.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 3. Navigation & Actions */}
        {filteredNav.length > 0 && (
          <>
            {(remoteProjects.length > 0 || remoteDeployments.length > 0) && <CommandSeparator />}
            <CommandGroup heading={query ? "Navigation & Settings" : "Quick Actions & Destinations"}>
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <span className="mr-2 shrink-0">{getNavIcon(item)}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">{item.title}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase font-mono">
                    {item.category}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 4. Quick Account Actions */}
        {!query && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Account Actions">
              <CommandItem
                onSelect={() =>
                  runCommand(async () => {
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                    } finally {
                      window.location.replace("/login");
                    }
                  })
                }
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2 text-destructive" />
                <span>Sign Out of DeployX</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer shortcut tips */}
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground border-t border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <span>Navigate with</span>
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">↑</kbd>
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">↓</kbd>
          <span>Select with</span>
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">↵</kbd>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Close with</span>
          <kbd className="rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px]">Esc</kbd>
        </div>
      </div>
    </CommandDialog>
  );
}
