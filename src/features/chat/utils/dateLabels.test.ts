import { describe, it, expect } from "vitest";
import { classifyDay, formatChatDate, formatChatTime } from "./dateLabels";

// Fixed "now", written WITHOUT a `Z` - i.e. in the runner's local zone.
// Calendar days are local by definition, so a UTC literal would put a case on
// the other side of midnight depending on where the suite runs.
const NOW = new Date("2026-09-24T10:00:00");

describe("classifyDay", () => {
  it("reads earlier the same day as today", () => {
    expect(classifyDay(new Date("2026-09-24T08:19:24"), NOW)).toBe("today");
  });

  it("reads the previous calendar day as yesterday", () => {
    expect(classifyDay(new Date("2026-09-23T23:50:00"), NOW)).toBe("yesterday");
  });

  // Twenty minutes apart, but on either side of midnight.
  it("splits on the calendar boundary, not on elapsed time", () => {
    const justAfterMidnight = new Date("2026-09-24T00:10:00");
    expect(classifyDay(new Date("2026-09-23T23:50:00"), justAfterMidnight)).toBe(
      "yesterday",
    );
    expect(classifyDay(new Date("2026-09-24T00:05:00"), justAfterMidnight)).toBe(
      "today",
    );
  });

  it("falls back to a plain date once it is older than yesterday", () => {
    expect(classifyDay(new Date("2026-09-22T23:59:00"), NOW)).toBe("older");
    expect(classifyDay(new Date("2026-06-01T12:00:00"), NOW)).toBe("older");
  });

  // Clock skew between the browser and the server, not a prediction.
  it("treats a timestamp in the future as today", () => {
    expect(classifyDay(new Date("2026-09-25T10:00:00"), NOW)).toBe("today");
  });
});

describe("chat formats", () => {
  it("keeps one date and one clock format across the chat", () => {
    const at = new Date("2026-09-22T08:19:24");
    expect(formatChatDate(at)).toBe("22.09.2026");
    expect(formatChatTime(at)).toBe("08:19");
  });
});
