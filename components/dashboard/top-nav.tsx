"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, CheckCircle2 } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-1 items-center gap-4">
        <nav className="hidden md:flex items-center space-x-2 text-sm font-medium text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center">
              {index > 0 && <span className="mx-2">/</span>}
              {crumb.isLast ? (
                <span className="text-foreground">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Trigger */}
        <Button
          variant="outline"
          className="relative h-8 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        >
          <span className="hidden lg:inline-flex">Search documentation...</span>
          <span className="inline-flex lg:hidden">Search...</span>
          <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* System Status */}
        <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Operational</span>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
          <span className="sr-only">Toggle notifications</span>
        </Button>

        {/* User Menu */}
        <div className="ml-2">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
