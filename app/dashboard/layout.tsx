import { Sidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col w-full">
        {/* We can add a top navbar here if needed later, but sidebar is main nav */}
        <main className="flex-1">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
