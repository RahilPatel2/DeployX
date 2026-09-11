import { UserButton } from "@/components/auth/user-button";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <UserButton />
      </header>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <p className="text-sm font-medium text-muted-foreground">Projects</p>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}
