import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EASING,
  SPRINGS,
  VIEWPORT_CONFIG,
  fadeUpVariants,
  fadeInVariants,
  slideInLeftVariants,
  slideInRightVariants,
  scaleInVariants,
  calculateCardTilt,
  containerStagger,
} from "../components/landing/motion-utils";

describe("Homepage Motion Design & Animation Tokens Suite", () => {
  it("exports valid cubic bezier easing curves", () => {
    assert.strictEqual(EASING.smooth.length, 4);
    assert.strictEqual(EASING.expo.length, 4);
    assert.strictEqual(EASING.bounce.length, 4);
    assert.strictEqual(EASING.soft.length, 4);

    // Easing bounds
    assert.ok(EASING.smooth[0] >= 0 && EASING.smooth[0] <= 1);
    assert.ok(EASING.smooth[2] >= 0 && EASING.smooth[2] <= 1);
  });

  it("exports calibrated spring physics presets", () => {
    assert.strictEqual(SPRINGS.snappy.type, "spring");
    assert.strictEqual(SPRINGS.gentle.type, "spring");
    assert.strictEqual(SPRINGS.bouncy.type, "spring");
    assert.strictEqual(SPRINGS.subtle.type, "spring");

    assert.ok(SPRINGS.snappy.stiffness > SPRINGS.gentle.stiffness);
    assert.ok(SPRINGS.snappy.damping > 20);
  });

  it("exports viewport scroll trigger configuration", () => {
    assert.strictEqual(VIEWPORT_CONFIG.once, true);
    assert.strictEqual(VIEWPORT_CONFIG.margin, "-80px");
    assert.strictEqual(VIEWPORT_CONFIG.amount, 0.15);
  });

  it("defines standard scroll entrance variants with hidden and visible states", () => {
    // Fade Up
    assert.ok(fadeUpVariants.hidden);
    assert.ok(fadeUpVariants.visible);

    // Fade In
    assert.ok(fadeInVariants.hidden);
    assert.ok(fadeInVariants.visible);

    // Slide in
    assert.ok(slideInLeftVariants.hidden);
    assert.ok(slideInLeftVariants.visible);
    assert.ok(slideInRightVariants.hidden);
    assert.ok(slideInRightVariants.visible);

    // Scale in
    assert.ok(scaleInVariants.hidden);
    assert.ok(scaleInVariants.visible);
  });

  it("generates configurable container stagger transitions", () => {
    const customStagger = containerStagger(0.15, 0.25);
    assert.ok(customStagger.hidden);
    assert.ok(customStagger.visible);
  });

  it("computes 3D card tilt angles accurately from cursor positions", () => {
    const mockRect = {
      left: 100,
      top: 100,
      width: 400,
      height: 200,
    } as DOMRect;

    // Center cursor -> 0 tilt
    const centerTilt = calculateCardTilt(
      { clientX: 300, clientY: 200 } as React.MouseEvent<HTMLDivElement>,
      mockRect,
      10
    );
    assert.ok(Math.abs(centerTilt.rotateX) < 0.001);
    assert.ok(Math.abs(centerTilt.rotateY) < 0.001);

    // Top-left cursor -> negative rotateY, positive rotateX
    const topLeftTilt = calculateCardTilt(
      { clientX: 100, clientY: 100 } as React.MouseEvent<HTMLDivElement>,
      mockRect,
      10
    );
    assert.ok(topLeftTilt.rotateX > 0);
    assert.ok(topLeftTilt.rotateY < 0);

    // Bottom-right cursor -> positive rotateY, negative rotateX
    const bottomRightTilt = calculateCardTilt(
      { clientX: 500, clientY: 300 } as React.MouseEvent<HTMLDivElement>,
      mockRect,
      10
    );
    assert.ok(bottomRightTilt.rotateX < 0);
    assert.ok(bottomRightTilt.rotateY > 0);
  });
});
