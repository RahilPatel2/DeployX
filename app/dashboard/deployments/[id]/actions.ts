"use server";

export async function cancelDeploymentAction() {
  // Mock action
}

export async function getDeploymentLogsAndStatus(deploymentId: string) {
  return { logs: [], status: "UNKNOWN", duration_seconds: 0, completed_at: null };
}
