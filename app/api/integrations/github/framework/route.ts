import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: 'github' });
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
    }

    // Try to get package.json
    const packageRes = await fetch(`https://api.github.com/repos/${repo}/contents/package.json?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    let framework = "Static HTML";
    let buildCommand = "";
    let outputDirectory = "public";
    let installCommand = "npm install";

    if (packageRes.ok) {
      const packageData = await packageRes.json();
      if (packageData.content) {
        try {
          const pkg = JSON.parse(Buffer.from(packageData.content, 'base64').toString('utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          if (deps.next) {
            framework = "Next.js";
            buildCommand = "npm run build";
            outputDirectory = ".next";
          } else if (deps.react && deps["react-scripts"]) {
            framework = "Create React App";
            buildCommand = "npm run build";
            outputDirectory = "build";
          } else if (deps.vite) {
            framework = "Vite";
            buildCommand = "npm run build";
            outputDirectory = "dist";
          } else if (deps.vue) {
            framework = "Vue";
            buildCommand = "npm run build";
            outputDirectory = "dist";
          } else if (deps.svelte) {
             framework = "SvelteKit";
             buildCommand = "npm run build";
             outputDirectory = "build";
          } else if (deps.astro) {
            framework = "Astro";
            buildCommand = "npm run build";
            outputDirectory = "dist";
          } else if (deps.nuxt) {
            framework = "Nuxt.js";
            buildCommand = "npm run build";
            outputDirectory = ".output/public";
          } else {
            framework = "Node.js";
            buildCommand = "npm run build";
            outputDirectory = "dist";
          }
        } catch(e) {
          console.error("Failed to parse package.json", e);
        }
      }
    }

    return NextResponse.json({ framework, buildCommand, outputDirectory, installCommand });
  } catch (error) {
    console.error("GitHub framework fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
