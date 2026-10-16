import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { CommandPalette } from "@/components/command-palette";
import { FloatingAssistant } from "@/components/ai/floating-assistant";

import { SWRDashboardProvider } from "@/components/swr-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }
  return (
    <SWRDashboardProvider>
      <div className="flex flex-col md:flex-row min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary/20">
        <Sidebar />
        <div className="flex-1 flex flex-col w-full min-w-0">
          <TopNav />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <CommandPalette />
        <FloatingAssistant />
      </div>
    </SWRDashboardProvider>
  );
}
