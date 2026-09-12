import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deployment | DeployX",
};

export default async function DeploymentDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Deployment {params.id}</h2>
      <p className="text-muted-foreground">Deployment details coming soon.</p>
    </div>
  );
}
