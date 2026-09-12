import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deployments | DeployX",
};

export default async function DeploymentsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Deployments</h2>
      <p className="text-muted-foreground">Deployments list coming soon.</p>
    </div>
  );
}
