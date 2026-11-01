"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, Shield, Palette, LogOut, Loader2 } from "lucide-react";
import useSWR, { mutate } from "swr";

export function UserButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data, error } = useSWR("/api/auth/profile", {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
  });

  const user = data?.user;

  // If unauthenticated or profile error, do not render user button
  if (error || !user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Evict all cached SWR data
      await mutate(() => true, undefined, { revalidate: false });
    } catch (e) {
      console.error("[Auth] Logout error:", e);
    } finally {
      window.location.replace("/login");
    }
  };

  const displayName = user.name || user.username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 overflow-hidden ring-1 ring-border/50 hover:ring-primary/40 transition-all active:scale-95" />}>
        <Avatar className="h-8 w-8 transition-opacity hover:opacity-90">
          <AvatarImage src={user.avatar || ""} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-1.5 shadow-xl border-border/60 bg-popover/95 backdrop-blur-md" align="end">
        {/* Profile Info Header */}
        <DropdownMenuLabel className="font-normal px-2 py-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border/50 shrink-0">
              <AvatarImage src={user.avatar || ""} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold leading-none truncate text-foreground">{displayName}</p>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user.email || `@${user.username}`}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 border-border/40" />

        {/* Core Profile & Account Navigation */}
        <DropdownMenuGroup className="space-y-0.5">
          <DropdownMenuItem render={<Link href="/dashboard/settings/profile" className="w-full cursor-pointer flex items-center px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted/60 transition-colors" />}>
            <User className="mr-2.5 h-4 w-4 text-primary" />
            <span>Edit Profile</span>
          </DropdownMenuItem>

          <DropdownMenuItem render={<Link href="/dashboard/settings" className="w-full cursor-pointer flex items-center px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted/60 transition-colors" />}>
            <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
            <span>Account Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem render={<Link href="/dashboard/settings/security" className="w-full cursor-pointer flex items-center px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted/60 transition-colors" />}>
            <Shield className="mr-2.5 h-4 w-4 text-emerald-500" />
            <span>Security & Sessions</span>
          </DropdownMenuItem>

          <DropdownMenuItem render={<Link href="/dashboard/settings/appearance" className="w-full cursor-pointer flex items-center px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted/60 transition-colors" />}>
            <Palette className="mr-2.5 h-4 w-4 text-amber-500" />
            <span>Appearance</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 border-border/40" />

        {/* Sign Out Action */}
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 px-2 py-1.5 rounded-md text-xs font-medium"
        >
          {isLoggingOut ? (
            <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-destructive" />
          ) : (
            <LogOut className="mr-2.5 h-4 w-4 text-destructive" />
          )}
          <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
