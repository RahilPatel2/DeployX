import connectToDatabase from "@/lib/mongodb/client";
import Deployment, { IDeployment } from "@/models/Deployment";
import Activity from "@/models/Activity";

export interface StaleRecoveryOptions {
  staleThresholdMs?: number; // Default: 15 minutes
  userId?: string;
}

export interface StaleRecoveryResult {
  recoveredCount: number;
  recoveredIds: string[];
}

/**
 * Recovers stale or interrupted in-progress deployments.
 * Deployments that have remained in QUEUED or BUILDING state for longer than
 * the stale threshold without updates are transitioned to FAILED with a diagnostic message.
 */
export async function recoverStaleDeployments(
  options: StaleRecoveryOptions = {}
): Promise<StaleRecoveryResult> {
  const { staleThresholdMs = 15 * 60 * 1000, userId } = options;
  await connectToDatabase();

  const cutoff = new Date(Date.now() - staleThresholdMs);

  const query: Record<string, unknown> = {
    status: { $in: ["QUEUED", "BUILDING"] },
    updatedAt: { $lt: cutoff },
  };

  if (userId) {
    query.userId = userId;
  }

  const staleDeployments: IDeployment[] = await Deployment.find(query);

  const recoveredIds: string[] = [];

  for (const dep of staleDeployments) {
    const errorMsg = "Deployment timed out or was interrupted before completion.";
    dep.status = "FAILED";
    dep.completedAt = new Date();
    dep.errorMessage = errorMsg;
    if (Array.isArray(dep.logs)) {
      dep.logs.push(`[DeployX] ❌ Auto-recovery: ${errorMsg}`);
    } else {
      dep.logs = [`[DeployX] ❌ Auto-recovery: ${errorMsg}`];
    }
    await dep.save();
    recoveredIds.push(dep._id.toString());

    // Record activity log
    try {
      await Activity.create({
        userId: dep.userId,
        projectId: dep.projectId,
        type: "deployment_failed",
        title: "Deployment timed out",
        description: `Deployment #${dep._id.toString().slice(-6)} timed out after remaining inactive.`,
        icon: "XCircle",
        color: "text-red-500",
      });
    } catch {
      // Activity log non-fatal
    }
  }

  return {
    recoveredCount: recoveredIds.length,
    recoveredIds,
  };
}
