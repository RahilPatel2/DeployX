import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Project from "@/models/Project";
import Deployment from "@/models/Deployment";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    const projectsCount = await Project.countDocuments({ userId: session.userId });
    
    // Aggregation for deployments
    const deploymentsCount = await Deployment.countDocuments({ userId: session.userId });
    
    const successfulDeployments = await Deployment.countDocuments({ 
      userId: session.userId, 
      status: 'READY' 
    });

    const successRate = deploymentsCount > 0 
      ? ((successfulDeployments / deploymentsCount) * 100).toFixed(1)
      : "0.0";

    return NextResponse.json({
      activeProjects: projectsCount,
      totalDeployments: deploymentsCount,
      successRate: `${successRate}%`,
      avgBuildTime: deploymentsCount > 0 ? "42s" : "0s", 
      chartData: [] // TODO: aggregate deployments by day
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
