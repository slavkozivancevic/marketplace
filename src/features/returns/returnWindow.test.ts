import { describe, it, expect } from "vitest";
import {
  isWithinReturnWindow,
  returnDaysLeft,
  returnDeadline,
} from "./returnWindow";

const delivered = new Date("2026-09-01T10:00:00.000Z");
const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe("returnDeadline", () => {
  it("counts from delivery, not from the order date", () => {
    expect(returnDeadline(delivered, 14).toISOString()).toBe(
      "2026-09-15T10:00:00.000Z",
    );
  });

  it("collapses to the delivery instant when the seller accepts no returns", () => {
    expect(returnDeadline(delivered, 0).getTime()).toBe(delivered.getTime());
  });
});

describe("isWithinReturnWindow", () => {
  it("accepts a request on the last day", () => {
    const lastDay = new Date(delivered.getTime() + days(14) - 1000);
    expect(isWithinReturnWindow(delivered, 14, lastDay)).toBe(true);
  });

  it("accepts a request exactly on the deadline", () => {
    const onTheDot = new Date(delivered.getTime() + days(14));
    expect(isWithinReturnWindow(delivered, 14, onTheDot)).toBe(true);
  });

  it("refuses a request one second past the deadline", () => {
    const tooLate = new Date(delivered.getTime() + days(14) + 1000);
    expect(isWithinReturnWindow(delivered, 14, tooLate)).toBe(false);
  });

  // 0 means "no returns", and the only way to express that is for every later
  // moment to fall outside. A request cannot arrive before delivery.
  it("refuses everything after delivery when the window is zero", () => {
    const aMinuteLater = new Date(delivered.getTime() + 60_000);
    expect(isWithinReturnWindow(delivered, 0, aMinuteLater)).toBe(false);
  });
});

describe("returnDaysLeft", () => {
  it("rounds up, so a part-day still reads as a day left", () => {
    const halfDayLeft = new Date(delivered.getTime() + days(13) + days(0.5));
    expect(returnDaysLeft(delivered, 14, halfDayLeft)).toBe(1);
  });

  it("reports the full window on the delivery day", () => {
    expect(returnDaysLeft(delivered, 14, delivered)).toBe(14);
  });

  it("never goes negative once the window has closed", () => {
    const longPast = new Date(delivered.getTime() + days(90));
    expect(returnDaysLeft(delivered, 14, longPast)).toBe(0);
  });
});
