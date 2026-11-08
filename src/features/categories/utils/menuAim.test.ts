import { describe, it, expect } from "vitest";
import { isAimingAt } from "./menuAim";

// A rail 0-200px wide, the panel to its right from y 100 to 500.
const panel = { left: 200, top: 100, bottom: 500 };

describe("isAimingAt", () => {
  it("is aiming on a diagonal toward the panel", () => {
    expect(isAimingAt({ x: 100, y: 150 }, { x: 120, y: 170 }, panel)).toBe(true);
    expect(isAimingAt({ x: 100, y: 450 }, { x: 120, y: 420 }, panel)).toBe(true);
  });

  it("is aiming when moving straight right", () => {
    expect(isAimingAt({ x: 50, y: 300 }, { x: 80, y: 300 }, panel)).toBe(true);
  });

  it("is not aiming when moving down the rail", () => {
    expect(isAimingAt({ x: 100, y: 150 }, { x: 102, y: 200 }, panel)).toBe(false);
    expect(isAimingAt({ x: 100, y: 150 }, { x: 100, y: 200 }, panel)).toBe(false);
  });

  it("is not aiming when moving left or standing still", () => {
    expect(isAimingAt({ x: 100, y: 150 }, { x: 90, y: 160 }, panel)).toBe(false);
    expect(isAimingAt({ x: 100, y: 150 }, { x: 100, y: 150 }, panel)).toBe(false);
  });

  it("is not aiming at a point the panel does not cover", () => {
    // Heading well above the panel's top edge.
    expect(isAimingAt({ x: 100, y: 120 }, { x: 110, y: 60 }, panel)).toBe(false);
  });

  it("is not aiming once the pointer is past the rail", () => {
    expect(isAimingAt({ x: 190, y: 300 }, { x: 205, y: 300 }, panel)).toBe(false);
  });
});
