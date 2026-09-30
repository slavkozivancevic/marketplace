import { describe, it, expect } from "vitest";
import { describeLastSeen } from "./presence";

// Fixed "now" so these never depend on the day the suite runs on.
//
// Written WITHOUT a `Z`, i.e. in the runner's local zone, on purpose: calendar
// days are local by definition, so a UTC literal would put a case on the other
// side of midnight depending on where the suite runs. Production timestamps
// are UTC and get read in the viewer's zone, which is exactly what we want -
// the header should match the clock on their wall.
const NOW = new Date("2026-09-23T10:00:00");

describe("describeLastSeen", () => {
  // The branch behind "a peer who has never been online": the header must end
  // up empty, never "Last seen Invalid Date" or a raw chat.lastSeenOn key.
  it("returns null when there is nothing to describe", () => {
    expect(describeLastSeen(undefined, NOW)).toBeNull();
    expect(describeLastSeen(null, NOW)).toBeNull();
    expect(describeLastSeen("", NOW)).toBeNull();
  });

  it("returns null for a timestamp that will not parse", () => {
    expect(describeLastSeen("not-a-date", NOW)).toBeNull();
    expect(describeLastSeen("2026-13-45T99:99:99Z", NOW)).toBeNull();
  });

  it("reads earlier the same day as today", () => {
    expect(describeLastSeen("2026-09-23T08:19:24", NOW)?.kind).toBe("today");
  });

  it("reads the previous calendar day as yesterday", () => {
    expect(describeLastSeen("2026-09-22T23:50:00", NOW)?.kind).toBe("yesterday");
  });

  // Twenty minutes apart, but on either side of midnight - calendar days are
  // what people read off a clock, not elapsed hours.
  it("splits on the calendar boundary, not on elapsed time", () => {
    const justAfterMidnight = new Date("2026-09-23T00:10:00");
    expect(describeLastSeen("2026-09-22T23:50:00", justAfterMidnight)?.kind).toBe(
      "yesterday",
    );
    expect(describeLastSeen("2026-09-23T00:05:00", justAfterMidnight)?.kind).toBe(
      "today",
    );
  });

  it("falls back to a plain date once it is older than yesterday", () => {
    expect(describeLastSeen("2026-09-21T23:59:00", NOW)?.kind).toBe("older");
    expect(describeLastSeen("2026-06-01T12:00:00", NOW)?.kind).toBe("older");
  });

  // Clock skew between the browser and the server, not a prediction.
  it("treats a marker in the future as today", () => {
    expect(describeLastSeen("2026-09-24T10:00:00", NOW)?.kind).toBe("today");
  });

  // The real input shape: the backend always stores UTC.
  it("accepts a UTC timestamp and reads it in the viewer's zone", () => {
    const utc = "2026-09-23T08:19:24.000Z";
    const sameInstantLocally = new Date(utc);
    expect(describeLastSeen(utc, sameInstantLocally)?.kind).toBe("today");
  });

  it("carries the parsed date through for formatting", () => {
    const r = describeLastSeen("2026-09-23T08:19:24.000Z", NOW);
    expect(r?.at.toISOString()).toBe("2026-09-23T08:19:24.000Z");
  });
});
