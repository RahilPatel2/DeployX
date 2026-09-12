export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Deployment {resolvedParams.id.substring(0, 8)}</h2>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed bg-black text-green-500 font-mono text-sm">
        <p>Build logs will appear here...</p>
      </div>
    </div>
  );
}
