import { describe, expect, it } from "vitest";
import { formatTimelineTimestamp } from "./timeline-timestamp";

const NOW = new Date(2026, 6, 3, 14, 0);

describe("formatTimelineTimestamp", () => {
  it("shows only the time for today", () => {
    const formatted = formatTimelineTimestamp(new Date(2026, 6, 3, 9, 5), "en-US", NOW);
    expect(formatted).toMatch(/9:05/);
    expect(formatted).not.toMatch(/Jul/);
  });

  it("labels yesterday with a time", () => {
    const formatted = formatTimelineTimestamp(new Date(2026, 6, 2, 22, 30), "en-US", NOW);
    expect(formatted.toLowerCase()).toContain("yesterday");
  });

  it("shows month and day within the year", () => {
    expect(formatTimelineTimestamp(new Date(2026, 3, 10), "en-US", NOW)).toBe("Apr 10");
  });

  it("shows a short date for old posts", () => {
    expect(formatTimelineTimestamp(new Date(2024, 0, 15), "en-US", NOW)).toMatch(/1\/15\/24/);
  });
});
