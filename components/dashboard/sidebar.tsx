"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Activity, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const routes = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Projects",
    icon: FolderKanban,
    href: "/dashboard/projects",
  },
  {
    label: "Deployments",
    icon: Activity,
    href: "/dashboard/deployments",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  },
];

const SidebarContent = ({ pathname }: { pathname: string }) => (
  <div className="space-y-4 py-4 flex flex-col h-full bg-secondary/10">
    <div className="px-3 py-2">
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">DeployX</h2>
      <div className="space-y-1">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-secondary rounded-lg transition-colors",
              pathname === route.href ? "bg-secondary text-primary" : "text-muted-foreground"
            )}
          >
            <div className="flex items-center flex-1">
              <route.icon className={cn("h-5 w-5 mr-3")} />
              {route.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  </div>
);

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="md:hidden flex items-center p-4 w-full border-b">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent pathname={pathname} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-lg ml-2">DeployX</span>
      </div>

      <div className="hidden md:flex h-full w-72 flex-col border-r">
        <SidebarContent pathname={pathname} />
      </div>
    </>
  );
}
