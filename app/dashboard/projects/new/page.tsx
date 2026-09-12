import { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Project | DeployX",
};

export default function NewProjectPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">New Project</h2>
      <p className="text-muted-foreground">New project creation coming soon.</p>
    </div>
  );
}
