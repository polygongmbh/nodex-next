import { describe, expect, it } from "vitest";
import { buildTopicEvent, parseTopicEvent, slugifyTopicName } from "./topic-events";
import { rawEvent } from "@/test/fixtures";

describe("topic events", () => {
  it("round-trips build → parse with primary-first ordering", () => {
    const built = buildTopicEvent("Nodex User Stories", "Design", ["nodex", "persona", "design"]);
    const parsed = parseTopicEvent(rawEvent({ kind: built.kind, tags: built.tags, content: "" }));
    expect(parsed).toMatchObject({
      id: "nodex-user-stories",
      name: "Nodex User Stories",
      primary: "design",
      secondary: ["nodex", "persona"],
    });
  });

  it("slugifies names to stable lowercase d-tags", () => {
    expect(slugifyTopicName("CalDav  Integration!")).toBe("caldav-integration");
  });

  it("rejects events without a d tag or channels", () => {
    expect(parseTopicEvent(rawEvent({ kind: 30177, tags: [["d", "x"]] }))).toBeNull();
    expect(parseTopicEvent(rawEvent({ kind: 30177, tags: [["t", "dev"]] }))).toBeNull();
  });
});
