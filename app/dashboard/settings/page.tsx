"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Shield,
  Palette,
  Bell,
  GitFork,
  ArrowRight,
  Loader2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SettingsGeneralPage() {
  const { data, isLoading } = useSWR("/api/auth/profile", fetcher);
  const user = data?.user;

  const quickLinks = [
    {
      title: "Profile & Avatar",
      description: "Manage your display name, username, bio, and custom profile picture.",
      href: "/dashboard/settings/profile",
      icon: User,
    },
    {
      title: "Security & Passwords",
      description: "Update your password, view active session tokens, and sign out.",
      href: "/dashboard/settings/security",
      icon: Shield,
    },
    {
      title: "Appearance",
      description: "Switch between dark, light, and system themes, and configure default project views.",
      href: "/dashboard/settings/appearance",
      icon: Palette,
    },
    {
      title: "Notifications",
      description: "Configure email alerts for failed builds and deployment completions.",
      href: "/dashboard/settings/notifications",
      icon: Bell,
    },
    {
      title: "GitHub Integration",
      description: "View connected repositories, OAuth scopes, or reconnect your account.",
      href: "/dashboard/settings/github",
      icon: GitFork,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account Settings Overview</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account profile, authentication credentials, and deployment preferences.
        </p>
      </div>

      {/* Account Summary Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Account Overview</CardTitle>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              Active Member
            </Badge>
          </div>
          <CardDescription>
            Your current account credentials and workspace status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-xs text-muted-foreground">Display Name</span>
                <p className="font-semibold text-sm mt-0.5 text-foreground">{user?.name || "Deployer"}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-xs text-muted-foreground">Username</span>
                <p className="font-semibold text-sm font-mono mt-0.5 text-foreground">@{user?.username || "user"}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-xs text-muted-foreground">Email Address</span>
                <p className="font-semibold text-sm mt-0.5 text-foreground truncate">{user?.email || "email"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Navigation Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full bg-card/40 backdrop-blur border-border/50 hover:border-primary/50 transition-all hover:shadow-md">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="font-semibold text-sm flex items-center justify-between text-foreground">
                    {item.title}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
