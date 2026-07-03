import { describe, expect, it } from "vitest";
import { buildTopicEvent, parseTopicEvent, topicIdForChannels } from "./topic-events";
import { rawEvent } from "@/test/fixtures";

describe("topic events", () => {
  it("round-trips build → parse with primary-first ordering", () => {
    const built = buildTopicEvent("Nodex User Stories", "Design", ["nodex", "persona", "design"]);
    const parsed = parseTopicEvent(rawEvent({ kind: built.kind, tags: built.tags, content: "" }));
    expect(parsed).toMatchObject({
      id: "design+nodex+persona",
      name: "Nodex User Stories",
      primary: "design",
      secondary: ["nodex", "persona"],
    });
  });

  it("identifies a topic by its channel set, not its name", () => {
    expect(topicIdForChannels(["nodex", "Design"])).toBe(topicIdForChannels(["design", "nodex"]));
    const a = buildTopicEvent("User Stories", "design", ["nodex"]);
    const b = buildTopicEvent("Nutzergeschichten", "nodex", ["design"]);
    expect(a.tags[0]).toEqual(b.tags[0]); // same d despite different names/primary
  });

  it("rejects events without channels", () => {
    expect(parseTopicEvent(rawEvent({ kind: 30177, tags: [["d", "x"]] }))).toBeNull();
  });
});
