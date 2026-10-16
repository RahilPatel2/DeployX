import { Metadata } from "next";
import Link from "next/link";
import { User, Shield, Box, GitFork, Bell, Palette, Settings as SettingsIcon, CreditCard, AlertTriangle, Cloud } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings | DeployX",
};

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

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account settings, preferences, and integrations.</p>
      </div>
      <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-10 lg:space-y-0">
        <aside className="w-full lg:w-56 shrink-0">
          <nav
            aria-label="Settings navigation"
            className="flex space-x-1 sm:space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-thin"
          >
            {sidebarNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
