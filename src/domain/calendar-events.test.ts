import { describe, expect, it } from "vitest";
import {
  buildCalendarEvent,
  encodeCalendarWhen,
  formatCalendarWhen,
  parseCalendarEvent,
  type CalendarEvent,
} from "./calendar-events";
import { NOSTR_KINDS } from "./nostr-kinds";

describe("buildCalendarEvent", () => {
  it("builds an all-day event as kind 31922 with ordered tags", () => {
    const built = buildCalendarEvent(
      { title: "Sprint review", allDay: true, start: "2026-07-10", content: "plan #dev", channels: ["dev"] },
      "evt-1"
    );
    expect(built.kind).toBe(NOSTR_KINDS.calendarDate);
    expect(built.content).toBe("plan #dev");
    expect(built.tags).toEqual([
      ["d", "evt-1"],
      ["title", "Sprint review"],
      ["start", "2026-07-10"],
      ["t", "dev"],
    ]);
  });

  it("builds a timed event as kind 31923 with end, location and lowercased channels", () => {
    const built = buildCalendarEvent(
      {
        title: "  Standup  ",
        allDay: false,
        start: "1751536800",
        end: "1751538600",
        location: "Room 4",
        content: "daily",
        channels: ["Ops", "dev"],
      },
      "evt-2"
    );
    expect(built.kind).toBe(NOSTR_KINDS.calendarTime);
    expect(built.tags).toEqual([
      ["d", "evt-2"],
      ["title", "Standup"],
      ["start", "1751536800"],
      ["end", "1751538600"],
      ["location", "Room 4"],
      ["t", "ops"],
      ["t", "dev"],
    ]);
  });

  it("round-trips through parseCalendarEvent", () => {
    const built = buildCalendarEvent(
      { title: "Launch", allDay: true, start: "2026-08-01", content: "", channels: ["launch"] },
      "evt-3"
    );
    const parsed = parseCalendarEvent(
      { id: "abc", pubkey: "alice", kind: built.kind, content: built.content, tags: built.tags, created_at: 100 },
      ["one"]
    );
    expect(parsed).toMatchObject({
      d: "evt-3",
      title: "Launch",
      start: "2026-08-01",
      channels: ["launch"],
      relays: ["one"],
    });
  });
});

describe("encodeCalendarWhen", () => {
  it("passes YYYY-MM-DD through for all-day drafts", () => {
    expect(
      encodeCalendarWhen({ title: "x", allDay: true, startDate: "2026-07-10", startTime: "", endDate: "2026-07-11" })
    ).toEqual({ start: "2026-07-10", end: "2026-07-11" });
  });

  it("encodes local date+time to unix seconds for timed drafts", () => {
    const { start } = encodeCalendarWhen({
      title: "x",
      allDay: false,
      startDate: "2026-07-10",
      startTime: "09:30",
    });
    expect(start).toBe(String(Math.floor(new Date("2026-07-10T09:30").getTime() / 1000)));
  });
});

describe("formatCalendarWhen", () => {
  const base: CalendarEvent = {
    d: "d",
    pubkey: "alice",
    eventId: "e",
    kind: NOSTR_KINDS.calendarDate,
    title: "t",
    start: "2026-07-10",
    content: "",
    channels: [],
    relays: ["one"],
    createdAt: 1,
  };

  it("formats an all-day date", () => {
    expect(formatCalendarWhen({ ...base }, "en-US")).toBe("Jul 10, 2026");
  });

  it("shows a date range when the end differs", () => {
    expect(formatCalendarWhen({ ...base, end: "2026-07-12" }, "en-US")).toBe(
      "Jul 10, 2026 – Jul 12, 2026"
    );
  });
});
