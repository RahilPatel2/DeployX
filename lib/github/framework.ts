import { getRepositoryFile } from "./api";

export interface FrameworkDetectionResult {
  framework: string;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
}

export async function detectFramework(
  accessToken: string,
  owner: string,
  repo: string,
  fallbackLanguage: string = "Other"
): Promise<FrameworkDetectionResult> {
  const defaultResult: FrameworkDetectionResult = {
    framework: fallbackLanguage,
    buildCommand: "npm run build",
    installCommand: "npm install",
    outputDirectory: "public",
  };

  try {
    const packageJsonContent = await getRepositoryFile(accessToken, owner, repo, "package.json");
    
    if (!packageJsonContent) {
      // If Python, could check requirements.txt
      const reqTxt = await getRepositoryFile(accessToken, owner, repo, "requirements.txt");
      if (reqTxt) {
        return {
          framework: "Python",
          buildCommand: "",
          installCommand: "pip install -r requirements.txt",
          outputDirectory: ".",
        };
      }
      return defaultResult;
    }

    const pkg = JSON.parse(packageJsonContent);
    const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const scripts = pkg.scripts || {};

    const installCmd = "npm install"; // Simplification: we could check for yarn.lock, pnpm-lock.yaml etc.
    const buildCmd = scripts.build ? "npm run build" : "";

    // Next.js
    if (dependencies["next"]) {
      return {
        framework: "Next.js",
        buildCommand: buildCmd,
        installCommand: installCmd,
        outputDirectory: ".next",
      };
    }

    // Astro
    if (dependencies["astro"]) {
      return {
        framework: "Astro",
        buildCommand: buildCmd,
        installCommand: installCmd,
        outputDirectory: "dist",
      };
    }

    // Nuxt
    if (dependencies["nuxt"]) {
      return {
        framework: "Nuxt",
        buildCommand: buildCmd || "npm run generate",
        installCommand: installCmd,
        outputDirectory: "dist",
      };
    }

    // Vite / React / Vue
    if (dependencies["vite"]) {
      const isReact = dependencies["react"];
      const isVue = dependencies["vue"];
      return {
        framework: isReact ? "React (Vite)" : isVue ? "Vue (Vite)" : "Vite",
        buildCommand: buildCmd,
        installCommand: installCmd,
        outputDirectory: "dist",
      };
    }

    // Create React App
    if (dependencies["react-scripts"]) {
      return {
        framework: "Create React App",
        buildCommand: buildCmd,
        installCommand: installCmd,
        outputDirectory: "build",
      };
    }
    
    // Angular
    if (dependencies["@angular/core"]) {
      return {
        framework: "Angular",
        buildCommand: buildCmd,
        installCommand: installCmd,
        outputDirectory: "dist",
      };
    }

    // Generic Node.js with package.json
    return {
      framework: "Node.js",
      buildCommand: buildCmd,
      installCommand: installCmd,
      outputDirectory: "dist",
    };

  } catch (error) {
    console.error("Framework detection error:", error);
    return defaultResult;
  }
}
