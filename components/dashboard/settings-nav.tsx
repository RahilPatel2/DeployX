"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Shield,
  Box,
  GitFork,
  Bell,
  Palette,
  Settings as SettingsIcon,
  CreditCard,
  AlertTriangle,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarNavItems = [
  { title: "General", href: "/dashboard/settings", icon: SettingsIcon },
  { title: "Profile", href: "/dashboard/settings/profile", icon: User },
  { title: "Appearance", href: "/dashboard/settings/appearance", icon: Palette },
  { title: "Billing", href: "/dashboard/settings/billing", icon: CreditCard },
  { title: "Security", href: "/dashboard/settings/security", icon: Shield },
  { title: "Notifications", href: "/dashboard/settings/notifications", icon: Bell },
  { title: "GitHub", href: "/dashboard/settings/github", icon: GitFork },
  { title: "Cloudflare", href: "/dashboard/settings/cloudflare", icon: Cloud },
  { title: "API Keys", href: "/dashboard/settings/api", icon: Box },
  { title: "Danger Zone", href: "/dashboard/settings/danger-zone", icon: AlertTriangle },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings navigation"
      className="flex space-x-1 sm:space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-thin"
    >
      {sidebarNavItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-150 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-xs border-l-2 lg:border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
