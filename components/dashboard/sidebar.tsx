"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Activity, Settings, Menu, Globe, Key, Users, Bell, GitBranch, TerminalSquare, Shield, Box } from "lucide-react";
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
    ]
  },
  {
    group: "Configuration",
    items: [
      { label: "Domains", icon: Globe, href: "/dashboard/domains" },
      { label: "Environment Variables", icon: Key, href: "/dashboard/environment-variables" },
    ]
  },
  {
    group: "Workspace",
    items: [
      { label: "Team", icon: Users, href: "/dashboard/team" },
      { label: "Activity", icon: GitBranch, href: "/dashboard/activity" },
      { label: "Notifications", icon: Bell, href: "/dashboard/notifications" },
    ]
  },
  {
    group: "Settings",
    items: [
      { label: "General", icon: Settings, href: "/dashboard/settings" },
      { label: "Security", icon: Shield, href: "/dashboard/settings/security" },
      { label: "API Keys", icon: Box, href: "/dashboard/settings/api" },
    ]
  }
];

const SidebarContent = ({ pathname }: { pathname: string }) => (
  <div className="space-y-4 py-4 flex flex-col h-full bg-sidebar">
    <div className="px-4 py-2">
      <Link href="/dashboard" className="flex items-center space-x-2 mb-6 px-2">
        <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
          <span className="text-background font-bold text-xs">DX</span>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">DeployX</h2>
      </Link>
      <div className="space-y-6">
        {routes.map((routeGroup, i) => (
          <div key={i} className="space-y-1">
            <h4 className="px-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
              {routeGroup.group}
            </h4>
            {routeGroup.items.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "text-sm group flex p-2 w-full justify-start font-medium cursor-pointer rounded-md transition-colors",
                  pathname === route.href || (pathname.startsWith(route.href) && route.href !== "/dashboard")
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center flex-1">
                  <route.icon className={cn("h-4 w-4 mr-3")} />
                  {route.label}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="md:hidden flex items-center p-4 w-full border-b bg-background">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent pathname={pathname} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-lg ml-2">DeployX</span>
      </div>

      <div className="hidden md:flex h-full w-64 flex-col border-r bg-sidebar">
        <SidebarContent pathname={pathname} />
      </div>
    </>
  );
}
