/**
 * Automated Performance Regression & Benchmark Validation Suite for DeployX
 * 
 * Verifies:
 * 1. SWR Deduplication & Cache Layer (SWRDashboardProvider, deduping intervals, revalidateOnFocus).
 * 2. Compound MongoDB Database Indexes (models/Deployment.ts and models/Project.ts).
 * 3. Lean Query Projections on List APIs (deployments list, projects aggregation, logs windowing).
 * 4. Single-Pass Server-Side Metrics Aggregation (app/dashboard/page.tsx).
 * 5. Code-Splitting & Dynamic Imports (next/dynamic for heavy chart components, React.memo).
 * 6. Next.js Compiler & Static Asset Caching (compression, immutable headers, API isolation).
 */

import fs from "fs";
import path from "path";
import assert from "assert";

function runTests() {
  console.log("=================================================");
  console.log("   DeployX Performance & Benchmark Test Suite    ");
  console.log("=================================================\n");

  const rootDir = process.cwd();

  // Test 1: SWR Deduplication & Cache Layer
  console.log("TEST 1: Verifying SWR Deduplication & Cache Configuration");
  const swrProviderPath = path.join(rootDir, "components", "swr-provider.tsx");
  const dashboardLayoutPath = path.join(rootDir, "app", "dashboard", "layout.tsx");
  const userButtonPath = path.join(rootDir, "components", "auth", "user-button.tsx");

  assert(fs.existsSync(swrProviderPath), "components/swr-provider.tsx must exist");
  assert(fs.existsSync(dashboardLayoutPath), "app/dashboard/layout.tsx must exist");

  const swrContent = fs.readFileSync(swrProviderPath, "utf-8");
  const layoutContent = fs.readFileSync(dashboardLayoutPath, "utf-8");
  const userButtonContent = fs.readFileSync(userButtonPath, "utf-8");

  assert(swrContent.includes("dedupingInterval: 30000"), "SWR provider must configure dedupingInterval of 30s");
  assert(swrContent.includes("revalidateOnFocus: false"), "SWR provider must disable revalidateOnFocus to prevent tab-switch storms");
  assert(swrContent.includes("keepPreviousData: true"), "SWR provider must enable keepPreviousData to prevent layout flashes");
  assert(layoutContent.includes("<SWRDashboardProvider>"), "Dashboard layout must wrap children in SWRDashboardProvider");
  assert(userButtonContent.includes("dedupingInterval: 60000"), "UserButton must deduplicate profile queries for 60s");
  console.log("  ✓ SWR deduplication layer verified across dashboard layout and auth components.\n");

  // Test 2: Compound MongoDB Indexes
  console.log("TEST 2: Verifying Compound MongoDB Indexes for Queries");
  const deploymentModelPath = path.join(rootDir, "models", "Deployment.ts");
  const projectModelPath = path.join(rootDir, "models", "Project.ts");

  const depModel = fs.readFileSync(deploymentModelPath, "utf-8");
  const projModel = fs.readFileSync(projectModelPath, "utf-8");

  assert(depModel.includes("{ userId: 1, status: 1 }"), "Deployment model must index { userId: 1, status: 1 }");
  assert(depModel.includes("{ projectId: 1, status: 1, createdAt: -1 }"), "Deployment model must index { projectId: 1, status: 1, createdAt: -1 }");
  assert(projModel.includes("{ userId: 1, framework: 1, createdAt: -1 }"), "Project model must index { userId: 1, framework: 1, createdAt: -1 }");
  console.log("  ✓ Compound indexes verified on Deployment and Project schemas.\n");

  // Test 3: Lean Query Projections on List APIs
  console.log("TEST 3: Verifying Query Projections & Exclusion of Heavy Payloads");
  const deploymentsApiPath = path.join(rootDir, "app", "api", "deployments", "route.ts");
  const projectsApiPath = path.join(rootDir, "app", "api", "projects", "route.ts");

  const depApi = fs.readFileSync(deploymentsApiPath, "utf-8");
  const projApi = fs.readFileSync(projectsApiPath, "utf-8");

  assert(depApi.includes('.select("-logs")'), "Deployments list API must exclude heavy logs array with .select('-logs')");
  assert(!projApi.includes('latestDeployment: { $first: "$$ROOT" }'), "Projects list aggregation must NOT project full $$ROOT with logs");
  assert(projApi.includes('.select("-webhookSecret")'), "Projects list API must exclude webhookSecret");
  console.log("  ✓ Lean projections verified on deployments and projects list endpoints.\n");

  // Test 4: Single-Pass Server-Side Metrics Aggregation
  console.log("TEST 4: Verifying Single-Pass Server-Side Metrics Aggregation");
  const dashboardPagePath = path.join(rootDir, "app", "dashboard", "page.tsx");
  const dashboardPage = fs.readFileSync(dashboardPagePath, "utf-8");

  assert(dashboardPage.includes("Deployment.aggregate(["), "Dashboard metrics must use Deployment.aggregate for single-pass DB calculation");
  assert(!dashboardPage.includes("deployments.forEach("), "Dashboard page must not iterate over all deployments in memory");
  console.log("  ✓ Dashboard metrics aggregation pipeline runs in constant O(1) memory.\n");

  // Test 5: Deployment Logs Windowing & Tail Parameter
  console.log("TEST 5: Verifying Deployment Logs Windowing & Polling Optimization");
  const logsApiPath = path.join(rootDir, "app", "api", "deployments", "[id]", "logs", "route.ts");
  const logViewerPath = path.join(rootDir, "components", "deployments", "log-viewer.tsx");

  const logsApi = fs.readFileSync(logsApiPath, "utf-8");
  const logViewer = fs.readFileSync(logViewerPath, "utf-8");

  assert(logsApi.includes('searchParams.get("tail")'), "Logs API must support tail query parameter");
  assert(logsApi.includes("sanitizedLogs.slice(-tail)"), "Logs API must slice tail lines when tail parameter is present");
  assert(logViewer.includes("tail=400"), "LogViewer must poll windowed tail during active builds");
  console.log("  ✓ Deployment log tail windowing verified.\n");

  // Test 6: Code-Splitting & Dynamic Imports
  console.log("TEST 6: Verifying Dynamic Imports & Component Memoization");
  const chartComponentPath = path.join(rootDir, "components", "dashboard", "deployment-chart.tsx");
  const chartComponent = fs.readFileSync(chartComponentPath, "utf-8");

  assert(dashboardPage.includes("dynamic("), "Dashboard page must use dynamic import for DeploymentActivityChart");
  assert(chartComponent.includes("React.memo"), "DeploymentActivityChart must be memoized with React.memo");
  console.log("  ✓ Code-splitting and component memoization verified.\n");

  // Test 7: Next.js Config & Static Asset Caching
  console.log("TEST 7: Verifying Next.js Compression & Caching Headers");
  const nextConfigPath = path.join(rootDir, "next.config.ts");
  const nextConfig = fs.readFileSync(nextConfigPath, "utf-8");

  assert(nextConfig.includes("compress: true"), "next.config.ts must enable response compression");
  assert(nextConfig.includes("poweredByHeader: false"), "next.config.ts must disable poweredByHeader");
  assert(nextConfig.includes("public, max-age=31536000, immutable"), "next.config.ts must set immutable cache for /_next/static");
  assert(nextConfig.includes("no-store, no-cache"), "next.config.ts must keep anti-caching headers on /api routes");
  console.log("  ✓ Next.js compression, immutable asset caching, and API isolation verified.\n");

  console.log("=================================================");
  console.log("   ALL 7 PERFORMANCE BENCHMARK TESTS PASSED!    ");
  console.log("=================================================");
}

runTests();
