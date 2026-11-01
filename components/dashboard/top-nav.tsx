"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, ChevronRight, Menu, Terminal } from "lucide-react";
import { UserButton } from "@/components/auth/user-button";
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/dashboard/sidebar-context";

export function TopNav() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();

  // Generate breadcrumbs from pathname
  const paths = pathname.split("/").filter(Boolean);
  const breadcrumbs = paths.map((path, index) => {
    const href = `/${paths.slice(0, index + 1).join("/")}`;
    const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
    const isLast = index === paths.length - 1;
    return { href, label, isLast };
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      const paths = pathname.split("/").filter(Boolean);
      const lastSegment = paths[paths.length - 1];
      const sectionName = lastSegment
        ? lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, " ")
        : "Dashboard";
      document.title = `${sectionName} | DeployX`;
    }
  }, [pathname]);

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent("deployx-open-search"));
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-background/80 px-3 sm:px-6 backdrop-blur-md">
      {/* Left Navigation: Mobile Hamburger + Breadcrumb Navigation */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {/* Mobile Hamburger Drawer Trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 active:scale-95 transition-transform"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </Button>

        {/* Mobile Brand Logo Icon */}
        <Link
          href="/dashboard"
          className="md:hidden h-6 w-6 bg-foreground rounded flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <span className="text-background font-bold text-[10px]">DX</span>
        </Link>

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-muted-foreground truncate">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors shrink-0 hidden sm:flex items-center gap-1.5 active:scale-95"
          >
            <Terminal className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>DeployX</span>
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.href} className="flex items-center space-x-1.5 truncate">
              {(idx > 0 || pathname !== "/dashboard") && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
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
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Quick Search Shortcut */}
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 px-2 sm:px-3 rounded-md bg-muted/30 hover:bg-muted/60 text-xs text-muted-foreground border-border/50 shadow-none font-normal active:scale-95 transition-all"
          onClick={handleOpenSearch}
          title="Search or jump to... (⌘K / Ctrl+K)"
        >
          <span className="hidden sm:inline-flex mr-2">Search...</span>
          <kbd className="pointer-events-none hidden h-4.5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span>⌘</span>K
          </kbd>
          <span className="sm:hidden text-xs">Search</span>
        </Button>

        {/* Global Edge Health */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground border border-border/40 px-2 py-1 rounded-md bg-muted/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Edge Active</span>
        </div>

        {/* Instant Interactive Notifications Popover */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="pl-1 border-l border-border/40">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
