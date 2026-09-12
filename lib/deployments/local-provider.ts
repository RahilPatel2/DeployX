import { DeploymentProvider, DeploymentState } from "./provider";
import { getSupabaseServerClient } from "@/lib/database/client";

/**
 * A mock provider for the free-tier implementation.
 * It simulates a deployment process by progressively updating the database state
 * and inserting mock build logs.
 */
export class LocalMockProvider implements DeploymentProvider {
  
  async createDeployment(deploymentId: string, projectId: string): Promise<void> {
    // In a real provider, we would send this to a job queue (e.g. SQS, Redis BullMQ)
    // or trigger an API call to a container runner.
    // For this mock, we will simulate it asynchronously in the background.
    
    // We do not await this so it runs detached.
    this.simulatePipeline(deploymentId, projectId).catch(console.error);
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentState> {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("deployments").select("status").eq("id", deploymentId).single();
    return (data?.status as DeploymentState) || "FAILED";
  }

  async cancelDeployment(deploymentId: string): Promise<void> {
    await this.updateStatus(deploymentId, "CANCELLED");
    await this.log(deploymentId, "info", "Deployment cancelled by user.");
  }

  private async simulatePipeline(deploymentId: string, projectId: string) {
    const supabase = getSupabaseServerClient();
    
    try {
      await this.updateStatus(deploymentId, "INITIALIZING");
      await this.log(deploymentId, "info", "Initializing deployment environment...");
      await this.sleep(2000);

      await this.updateStatus(deploymentId, "CLONING");
      await this.log(deploymentId, "info", "Cloning repository...");
      await this.sleep(3000);
      await this.log(deploymentId, "info", "Repository cloned successfully.");

      await this.updateStatus(deploymentId, "INSTALLING");
      await this.log(deploymentId, "info", "Detecting framework and installing dependencies...");
      await this.sleep(4000);
      await this.log(deploymentId, "info", "Dependencies installed.");

      await this.updateStatus(deploymentId, "BUILDING");
      await this.log(deploymentId, "info", "Running production build...");
      await this.sleep(5000);
      await this.log(deploymentId, "info", "Build completed successfully.");

      await this.updateStatus(deploymentId, "UPLOADING");
      await this.log(deploymentId, "info", "Uploading assets to CDN...");
      await this.sleep(2000);

      await this.updateStatus(deploymentId, "FINALIZING");
      await this.log(deploymentId, "info", "Finalizing deployment...");
      
      const mockUrl = `https://${projectId.substring(0, 8)}-preview.deployx.dev`;
      
      await supabase
        .from("deployments")
        .update({ 
          status: "READY", 
          deployment_url: mockUrl,
          completed_at: new Date().toISOString()
        })
        .eq("id", deploymentId);
        
      await supabase
        .from("projects")
        .update({ production_url: mockUrl, status: "READY" })
        .eq("id", projectId);

      await this.log(deploymentId, "info", "Deployment ready.");
      
    } catch (e) {
      await this.updateStatus(deploymentId, "FAILED");
      await this.log(deploymentId, "error", `Deployment failed: ${(e as Error).message}`);
    }
  }

  private async updateStatus(deploymentId: string, status: DeploymentState) {
    const supabase = getSupabaseServerClient();
    await supabase.from("deployments").update({ status }).eq("id", deploymentId);
  }

  private async log(deploymentId: string, level: string, message: string) {
    const supabase = getSupabaseServerClient();
    await supabase.from("build_logs").insert({
      deployment_id: deploymentId,
      level,
      message,
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const deploymentProvider = new LocalMockProvider();
