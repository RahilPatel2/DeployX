"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, ChevronRight, Terminal } from "lucide-react";
import { UserButton } from "@/components/auth/user-button";
import { Button } from "@/components/ui/button";

export function TopNav() {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const paths = pathname.split("/").filter(Boolean);
  const breadcrumbs = paths.map((path, index) => {
    const href = `/${paths.slice(0, index + 1).join("/")}`;
    const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
    const isLast = index === paths.length - 1;
    return { href, label, isLast };
  });

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border/40 bg-background/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center min-w-0 overflow-hidden">
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-muted-foreground truncate">
          <Link href="/dashboard" className="hover:text-foreground transition-colors shrink-0 flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="hidden sm:inline">DeployX</span>
          </Link>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center space-x-1.5 truncate">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              {crumb.isLast ? (
                <span className="text-foreground font-semibold truncate">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors truncate">
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Search Shortcut */}
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 px-2.5 sm:px-3 rounded-md bg-muted/30 hover:bg-muted/60 text-xs text-muted-foreground border-border/50 shadow-none font-normal"
          onClick={() => {
            // Dispatch Cmd+K to open Command Palette
            const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
        >
          <span className="hidden sm:inline-flex mr-2">Search...</span>
          <kbd className="pointer-events-none hidden h-4.5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span>⌘</span>K
          </kbd>
        </Button>

        {/* Global Edge Health */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground border border-border/40 px-2 py-1 rounded-md bg-muted/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Cloudflare Edge</span>
        </div>

        {/* Notifications */}
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </Link>

        {/* User Menu */}
        <div className="pl-1 border-l border-border/40">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
