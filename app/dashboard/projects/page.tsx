import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | DeployX",
};

export default function ProjectsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
      <p className="text-muted-foreground">Projects list coming soon.</p>
    </div>
  );
}
