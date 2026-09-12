export type DeploymentState = 
  | "QUEUED"
  | "INITIALIZING"
  | "CLONING"
  | "INSTALLING"
  | "BUILDING"
  | "UPLOADING"
  | "FINALIZING"
  | "READY"
  | "FAILED"
  | "CANCELLED";

export interface DeploymentProvider {
  /**
   * Triggers a new deployment pipeline.
   * @param deploymentId The internal UUID of the deployment.
   * @param projectId The internal UUID of the project.
   */
  createDeployment(deploymentId: string, projectId: string): Promise<void>;
  
  /**
   * Retrieves the current state from the external provider if applicable.
   */
  getDeploymentStatus(deploymentId: string): Promise<DeploymentState>;
  
  /**
   * Cancels an ongoing deployment.
   */
  cancelDeployment(deploymentId: string): Promise<void>;
}
