import { describe, expect, it } from "vite-plus/test";
import { project, rubberband, VelocityTracker } from "./motion";

describe("project", () => {
  it("carries further for faster releases and nowhere when still", () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0); // 0.998: about half a second of travel
    expect(project(600, 0.995)).toBeCloseTo(119.4, 1);
    expect(project(-600, 0.995)).toBeCloseTo(-119.4, 1);
  });
});

describe("rubberband", () => {
  it("follows less the further past the edge", () => {
    const h = 700;
    expect(rubberband(0, h)).toBe(0);
    expect(rubberband(80, h)).toBeLessThan(80);
    expect(rubberband(400, h) - rubberband(300, h)).toBeLessThan(
      rubberband(100, h) - rubberband(0, h),
    );
  });
});

describe("VelocityTracker", () => {
  it("measures px/s over the last 100ms", () => {
    const t = new VelocityTracker();
    t.add(0, 1000);
    t.add(20, 1020);
    t.add(40, 1040);
    expect(t.velocity(1040)).toBeCloseTo(1000, 0);
  });

  it("reads a pause before release as stopped", () => {
    const t = new VelocityTracker();
    t.add(0, 1000);
    t.add(50, 1020);
    expect(t.velocity(1300)).toBe(0);
  });
});
