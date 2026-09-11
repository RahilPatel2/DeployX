import { getSupabaseServerClient } from "@/lib/database/client";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await auth();
  const supabase = getSupabaseServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Ensure user owns project
  if (project.user_id !== session?.user?.id) {
    return <div className="p-8">Unauthorized.</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
      </div>
      
      <div className="rounded-md border p-6">
        <h3 className="text-lg font-medium">Project Details</h3>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Repository</dt>
            <dd className="mt-1 text-sm">{project.repository_owner}/{project.repository_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Branch</dt>
            <dd className="mt-1 text-sm">{project.branch}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Framework</dt>
            <dd className="mt-1 text-sm">{project.framework || "Auto-detecting..."}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Status</dt>
            <dd className="mt-1 text-sm">{project.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
