"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Settings,
  Globe,
  Key,
  Users,
  Bell,
  GitBranch,
  TerminalSquare,
  Shield,
  Box,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSidebar } from "@/components/dashboard/sidebar-context";
import { preloadRouteData } from "@/components/swr-provider";

interface RouteItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface RouteGroup {
  group: string;
  items: RouteItem[];
}

const routes: RouteGroup[] = [
  {
    group: "General",
    items: [
      { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Projects", icon: FolderKanban, href: "/dashboard/projects" },
      { label: "Deployments", icon: TerminalSquare, href: "/dashboard/deployments" },
      { label: "Analytics", icon: Activity, href: "/dashboard/analytics" },
    ],
  },
  {
    group: "Configuration",
    items: [
      { label: "Domains", icon: Globe, href: "/dashboard/domains" },
      { label: "Environment Variables", icon: Key, href: "/dashboard/environment-variables" },
    ],
  },
  {
    group: "Workspace",
    items: [
      { label: "Team", icon: Users, href: "/dashboard/team" },
      { label: "Activity", icon: GitBranch, href: "/dashboard/activity" },
      { label: "Notifications", icon: Bell, href: "/dashboard/notifications" },
    ],
  },
  {
    group: "Settings",
    items: [
      { label: "General", icon: Settings, href: "/dashboard/settings" },
      { label: "Security", icon: Shield, href: "/dashboard/settings/security" },
      { label: "API Keys", icon: Box, href: "/dashboard/settings/api" },
    ],
  },
];

function isRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/dashboard/settings") {
    // Avoid active conflict if on /dashboard/settings/security or /dashboard/settings/api
    return pathname === "/dashboard/settings" || (
      pathname.startsWith("/dashboard/settings") &&
      !pathname.startsWith("/dashboard/settings/security") &&
      !pathname.startsWith("/dashboard/settings/api")
    );
  }
  return pathname.startsWith(href + "/") || pathname.startsWith(href);
}

interface NavContentProps {
  pathname: string;
  isCollapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

function NavContent({ pathname, isCollapsed = false, onNavigate, onToggleCollapse }: NavContentProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar select-none transition-all duration-200">
      {/* Workspace Brand Header */}
      <div className={cn("border-b border-border/40 shrink-0", isCollapsed ? "p-3 flex justify-center" : "p-4")}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            "flex items-center rounded-md hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isCollapsed ? "justify-center p-1" : "space-x-2.5 px-2 py-1.5"
          )}
          title="DeployX Cloud — Production Workspace"
        >
          <div className="h-7 w-7 bg-foreground rounded flex items-center justify-center shrink-0 shadow-xs">
            <span className="text-background font-bold text-xs tracking-tight">DX</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-foreground truncate">DeployX Cloud</span>
              <span className="text-[11px] text-muted-foreground truncate">Production Workspace</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className={cn("flex-1 overflow-y-auto space-y-5 scrollbar-thin", isCollapsed ? "px-2 py-3" : "px-3 py-4")}>
        {routes.map((routeGroup, i) => (
          <div key={i} className="space-y-1">
            {!isCollapsed ? (
              <h4 className="px-3 text-[11px] font-semibold uppercase text-muted-foreground/80 tracking-wider">
                {routeGroup.group}
              </h4>
            ) : (
              i > 0 && <div className="h-px bg-border/40 mx-2 my-2" />
            )}
            <div className="space-y-0.5 pt-0.5">
              {routeGroup.items.map((route) => {
                const isActive = isRouteActive(pathname, route.href);

                const handlePrefetch = () => {
                  if (route.href === "/dashboard/projects") {
                    preloadRouteData("/api/projects?limit=12&sort=createdAt&order=desc&page=1");
                  } else if (route.href === "/dashboard/deployments") {
                    preloadRouteData("/api/deployments");
                  } else if (route.href === "/dashboard/analytics") {
                    preloadRouteData("/api/analytics?range=7d");
                  } else if (route.href === "/dashboard/notifications") {
                    preloadRouteData("/api/notifications?limit=8");
                  }
                };

                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    prefetch={true}
                    onClick={onNavigate}
                    onMouseEnter={handlePrefetch}
                    aria-current={isActive ? "page" : undefined}
                    title={isCollapsed ? route.label : undefined}
                    className={cn(
                      "group flex items-center rounded-md transition-all duration-150 relative text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                      isCollapsed
                        ? "justify-center h-9 w-9 mx-auto p-0"
                        : "px-3 py-2 w-full",
                      isActive
                        ? "bg-secondary text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <route.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isCollapsed ? "mx-auto" : "mr-2.5",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{route.label}</span>}
                    {isActive && (
                      <span
                        className={cn(
                          "absolute bg-primary rounded-full",
                          isCollapsed
                            ? "left-0 top-1/2 -translate-y-1/2 w-1 h-4"
                            : "left-1 top-1/2 -translate-y-1/2 w-1 h-3.5"
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer & Collapse Toggle */}
      <div className="p-3 border-t border-border/40 shrink-0 space-y-2">
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors h-8",
              isCollapsed ? "justify-center px-0" : "justify-between px-2.5"
            )}
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Collapse</span>
                </span>
                <kbd className="hidden sm:inline-block font-mono text-[10px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                  ⌘B
                </kbd>
              </>
            )}
          </Button>
        )}

        {/* Edge Network Status indicator */}
        <div
          className={cn(
            "text-[11px] text-muted-foreground flex items-center",
            isCollapsed ? "justify-center py-1" : "justify-between px-2.5 py-1"
          )}
          title="Edge Network: Online"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            {!isCollapsed && <span>Edge Network</span>}
          </div>
          {!isCollapsed && <span className="font-mono text-[10px] text-muted-foreground/60">v2.1</span>}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen, closeMobileDrawer } = useSidebar();

  return (
    <>
      {/* Mobile Drawer (Controlled by Sheet via SidebarContext) */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-0 z-50">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <NavContent pathname={pathname} isCollapsed={false} onNavigate={closeMobileDrawer} />
        </SheetContent>
      </Sheet>

      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen sticky top-0 flex-col border-r border-border/40 bg-sidebar shrink-0 z-30 transition-[width] duration-200 ease-in-out",
          isCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        <NavContent
          pathname={pathname}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>
    </>
  );
}
