import { Metadata } from "next";
import Link from "next/link";
import { User, Shield, Box, GitFork, Bell, Palette, Settings as SettingsIcon, CreditCard, AlertTriangle } from "lucide-react";

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
  { title: "API Keys", href: "/dashboard/settings/api", icon: Box },
  { title: "Danger Zone", href: "/dashboard/settings/danger-zone", icon: AlertTriangle },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="space-y-0.5">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 px-4">
            {sidebarNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
