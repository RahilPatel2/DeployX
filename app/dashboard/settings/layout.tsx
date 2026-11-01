import { Metadata } from "next";
import { Suspense } from "react";
import { SettingsNav } from "@/components/dashboard/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your DeployX account, security, and project integrations",
};

function SettingsSubRouteSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-150">
      <Skeleton className="h-6 w-48 rounded" />
      <Skeleton className="h-4 w-80 rounded" />
      <div className="pt-2 space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account settings, preferences, and integrations.</p>
      </div>
      <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-10 lg:space-y-0">
        <aside className="w-full lg:w-56 shrink-0">
          <SettingsNav />
        </aside>
        <div className="flex-1 min-w-0">
          <Suspense fallback={<SettingsSubRouteSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
