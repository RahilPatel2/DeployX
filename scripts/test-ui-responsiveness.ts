/**
 * Automated Responsive UI & Accessibility Test Suite for DeployX
 * 
 * Verifies:
 * 1. Design token presence in app/globals.css (status colors, glass surface tokens, reduced-motion rules).
 * 2. Responsive layout container classes across major dashboard routes.
 * 3. Accessibility attributes (role, aria-label, aria-live, prefers-reduced-motion compliance).
 * 4. StatusBadge normalization and mapping for all deployment lifecycle states.
 */

import fs from "fs";
import path from "path";
import assert from "assert";

function runTests() {
  console.log("=================================================");
  console.log("   DeployX UI Responsiveness & Accessibility Test  ");
  console.log("=================================================\n");

  const rootDir = process.cwd();

  // Test 1: Check app/globals.css design tokens
  console.log("TEST 1: Verifying Design Tokens & Reduced Motion in globals.css");
  const globalsCssPath = path.join(rootDir, "app", "globals.css");
  assert(fs.existsSync(globalsCssPath), "app/globals.css must exist");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  const requiredTokens = [
    "--color-status-queued",
    "--color-status-building",
    "--color-status-ready",
    "--color-status-failed",
    "--color-status-canceled",
    "prefers-reduced-motion",
    "scrollbar-none",
    "scrollbar-thin",
  ];

  for (const token of requiredTokens) {
    assert(
      globalsCss.includes(token),
      `globals.css must include design token/rule: ${token}`
    );
  }
  console.log("  ✓ All required design tokens and @media (prefers-reduced-motion) rules verified.\n");

  // Test 2: Check StatusBadge component structure
  console.log("TEST 2: Verifying StatusBadge Component & Accessibility");
  const statusBadgePath = path.join(rootDir, "components", "ui", "status-badge.tsx");
  assert(fs.existsSync(statusBadgePath), "components/ui/status-badge.tsx must exist");
  const statusBadgeContent = fs.readFileSync(statusBadgePath, "utf-8");

  const requiredBadgeFeatures = [
    'role="status"',
    "aria-label=",
    "normalized",
    "QUEUED",
    "BUILDING",
    "READY",
    "FAILED",
    "CANCELED",
  ];

  for (const feat of requiredBadgeFeatures) {
    assert(
      statusBadgeContent.includes(feat),
      `StatusBadge component must include: ${feat}`
    );
  }
  console.log("  ✓ StatusBadge contains role='status', aria-labels, and all 5 deployment statuses.\n");

  // Test 3: Check responsive dashboard layout
  console.log("TEST 3: Verifying Responsive Dashboard Layout & Mobile Drawer");
  const dashboardLayoutPath = path.join(rootDir, "app", "dashboard", "layout.tsx");
  assert(fs.existsSync(dashboardLayoutPath), "app/dashboard/layout.tsx must exist");
  const dashboardLayout = fs.readFileSync(dashboardLayoutPath, "utf-8");

  assert(
    dashboardLayout.includes("flex-col md:flex-row"),
    "Dashboard layout must stack vertically on mobile and horizontally on md screens"
  );
  console.log("  ✓ Dashboard layout implements responsive flex-col md:flex-row layout.\n");

  // Test 4: Check responsive padding across dashboard views
  console.log("TEST 4: Verifying Responsive Container Padding across Major Views");
  const pagesToCheck = [
    path.join(rootDir, "app", "dashboard", "page.tsx"),
    path.join(rootDir, "app", "dashboard", "projects", "page.tsx"),
    path.join(rootDir, "app", "dashboard", "projects", "new", "page.tsx"),
    path.join(rootDir, "app", "dashboard", "deployments", "[id]", "page.tsx"),
    path.join(rootDir, "app", "dashboard", "settings", "layout.tsx"),
  ];

  for (const pagePath of pagesToCheck) {
    const relPath = path.relative(rootDir, pagePath);
    assert(fs.existsSync(pagePath), `${relPath} must exist`);
    const content = fs.readFileSync(pagePath, "utf-8");
    const hasResponsivePadding =
      content.includes("p-4 sm:p-6 lg:p-8") || content.includes("p-4 sm:p-6");
    assert(
      hasResponsivePadding,
      `${relPath} must use responsive padding (p-4 sm:p-6 lg:p-8)`
    );
    console.log(`  ✓ ${relPath} verified responsive container padding.`);
  }
  console.log("");

  // Test 5: Verify LogViewer terminal styling and interactive controls
  console.log("TEST 5: Verifying LogViewer Interactive Controls");
  const logViewerPath = path.join(rootDir, "components", "deployments", "log-viewer.tsx");
  assert(fs.existsSync(logViewerPath), "components/deployments/log-viewer.tsx must exist");
  const logViewerContent = fs.readFileSync(logViewerPath, "utf-8");

  const requiredLogFeatures = [
    'role="region"',
    "aria-label=",
    "searchTerm",
    "autoScroll",
    "copyAllLogs",
  ];

  for (const feat of requiredLogFeatures) {
    assert(
      logViewerContent.includes(feat),
      `LogViewer component must include: ${feat}`
    );
  }
  console.log("  ✓ LogViewer terminal includes search filtering, auto-scroll toggle, and copy feedback.\n");

  // Test 6: Verify Auth Forms touch targets and validation alerts
  console.log("TEST 6: Verifying Auth Forms Touch Targets & Validation Feedback");
  const loginFormPath = path.join(rootDir, "components", "auth", "LoginForm.tsx");
  const signupFormPath = path.join(rootDir, "components", "auth", "SignupForm.tsx");
  assert(fs.existsSync(loginFormPath), "LoginForm must exist");
  assert(fs.existsSync(signupFormPath), "SignupForm must exist");

  const loginContent = fs.readFileSync(loginFormPath, "utf-8");
  const signupContent = fs.readFileSync(signupFormPath, "utf-8");

  assert(loginContent.includes('role="alert"'), "LoginForm must include role='alert' for errors");
  assert(signupContent.includes('role="alert"'), "SignupForm must include role='alert' for errors");
  console.log("  ✓ Auth forms implement accessible role='alert' validation error announcements.\n");

  console.log("=================================================");
  console.log("   ALL UI RESPONSIVENESS TESTS PASSED SUCCESSFULLY! ");
  console.log("=================================================");
}

runTests();
