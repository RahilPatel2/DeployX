"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Settings,
  Menu,
  Globe,
  Key,
  Users,
  Bell,
  GitBranch,
  TerminalSquare,
  Shield,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const routes = [
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

interface SidebarContentProps {
  pathname: string;
  onNavigate?: () => void;
}

const SidebarContent = ({ pathname, onNavigate }: SidebarContentProps) => (
  <div className="flex flex-col h-full bg-sidebar select-none">
    {/* Workspace Header */}
    <div className="p-4 border-b border-border/40">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center space-x-2.5 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors"
      >
        <div className="h-7 w-7 bg-foreground rounded flex items-center justify-center shrink-0">
          <span className="text-background font-bold text-xs tracking-tight">DX</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">DeployX Cloud</span>
          <span className="text-[11px] text-muted-foreground truncate">Production Workspace</span>
        </div>
      </Link>
    </div>

    {/* Navigation Items */}
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {routes.map((routeGroup, i) => (
        <div key={i} className="space-y-1">
          <h4 className="px-3 text-[11px] font-semibold uppercase text-muted-foreground/80 tracking-wider">
            {routeGroup.group}
          </h4>
          <div className="space-y-0.5 pt-1">
            {routeGroup.items.map((route) => {
              const isActive =
                pathname === route.href ||
                (pathname.startsWith(route.href) && route.href !== "/dashboard");

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-xs group flex items-center px-3 py-2 w-full font-medium rounded-md transition-all duration-150",
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <route.icon
                    className={cn(
                      "h-4 w-4 mr-2.5 shrink-0 transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate">{route.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>

    {/* Footer indicator */}
    <div className="p-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between px-4">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Edge Network Online</span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground/60">v2.0</span>
    </div>
  </div>
);

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Top App Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 w-full border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open navigation menu" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-background font-bold text-xs">DX</span>
            </div>
            <span className="font-bold text-sm tracking-tight">DeployX</span>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 w-64 flex-col border-r border-border/40 bg-sidebar shrink-0 z-30">
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  );
}
