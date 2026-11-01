import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Project from "../models/Project";
import Deployment from "../models/Deployment";
import Notification from "../models/Notification";
import { preloadRouteData } from "../components/swr-provider";

describe("Performance & Instant Interaction Regression Suite", () => {
  it("verifies compound indexes are configured on Project schema", () => {
    const indexes = Project.schema.indexes();
    const indexFields = indexes.map((idx) => Object.keys(idx[0]).join(","));

    // Verify key performance indexes
    assert.ok(
      indexFields.some((f) => f.includes("userId") && f.includes("createdAt")),
      "Missing compound index for userId + createdAt on Project"
    );
    assert.ok(
      indexFields.some((f) => f.includes("userId") && f.includes("name")),
      "Missing compound index for userId + name on Project"
    );
    assert.ok(
      indexFields.some((f) => f.includes("userId") && f.includes("updatedAt")),
      "Missing compound index for userId + updatedAt on Project"
    );
  });

  it("verifies compound indexes are configured on Deployment schema", () => {
    const indexes = Deployment.schema.indexes();
    const indexFields = indexes.map((idx) => Object.keys(idx[0]).join(","));

    assert.ok(
      indexFields.some((f) => f.includes("userId") && f.includes("status")),
      "Missing compound index for userId + status on Deployment"
    );
    assert.ok(
      indexFields.some((f) => f.includes("projectId") && f.includes("createdAt")),
      "Missing compound index for projectId + createdAt on Deployment"
    );
  });

  it("verifies compound indexes are configured on Notification schema", () => {
    const indexes = Notification.schema.indexes();
    const indexFields = indexes.map((idx) => Object.keys(idx[0]).join(","));

    assert.ok(
      indexFields.some((f) => f.includes("userId") && f.includes("read")),
      "Missing compound index for userId + read on Notification"
    );
  });

  it("exports SWR preloadRouteData without throwing when executed", () => {
    assert.strictEqual(typeof preloadRouteData, "function");
    // Should safely execute in non-browser context without crashing
    assert.doesNotThrow(() => {
      preloadRouteData("/api/projects");
    });
  });

  it("validates in-memory search LRU behavior simulation", () => {
    const testMap = new Map<string, string[]>();
    const MAX_SIZE = 3;

    function put(key: string, value: string[]) {
      if (testMap.size >= MAX_SIZE) {
        const oldest = testMap.keys().next().value;
        if (oldest) testMap.delete(oldest);
      }
      testMap.set(key, value);
    }

    put("dep", ["deployx"]);
    put("depl", ["deployx"]);
    put("deplo", ["deployx"]);
    assert.strictEqual(testMap.size, 3);
    assert.ok(testMap.has("dep"));

    put("deploy", ["deployx"]);
    assert.strictEqual(testMap.size, 3);
    // Oldest "dep" should have been evicted
    assert.strictEqual(testMap.has("dep"), false);
    assert.ok(testMap.has("deploy"));
  });
});
