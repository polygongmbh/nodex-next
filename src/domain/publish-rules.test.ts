import { describe, expect, it } from "vitest";
import {
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "./publish-rules";
import { post } from "@/test/fixtures";

const RELAYS = [
  { id: "one-example", url: "wss://one.example/", connected: true },
  { id: "two-example", url: "wss://two.example/", connected: true },
  { id: "three-example", url: "wss://three.example/", connected: false },
];

describe("resolvePublishRelay", () => {
  it("uses the single active relay when a space is selected", () => {
    expect(resolvePublishRelay(RELAYS, "two-example").id).toBe("two-example");
  });

  it("falls back to the sole connected relay", () => {
    const single = [RELAYS[0], RELAYS[2]];
    expect(resolvePublishRelay(single, null).id).toBe("one-example");
  });

  it("errors when the target is ambiguous or absent", () => {
    expect(() => resolvePublishRelay(RELAYS, null)).toThrow(PublishRuleError);
    expect(() => resolvePublishRelay([RELAYS[2]], null)).toThrow(PublishRuleError);
  });

  it("pins replies to the parent's origin relay", () => {
    const parent = post({ relays: ["two-example", "one-example"] });
    expect(resolvePublishRelay(RELAYS, "one-example", parent).id).toBe("two-example");
  });
});

describe("buildMessageTags", () => {
  it("writes every channel as a lowercased t-tag", () => {
    expect(buildMessageTags(["General", "design"])).toEqual([
      ["t", "general"],
      ["t", "design"],
    ]);
  });

  it("requires at least one channel", () => {
    expect(() => buildMessageTags([])).toThrow(PublishRuleError);
  });

  it("links replies via a parent-marked e-tag", () => {
    const parent = post();
    const tags = buildMessageTags(["general"], parent);
    expect(tags).toContainEqual(["e", parent.id, "", "parent"]);
    expect(tags).toContainEqual(["p", parent.pubkey]);
  });
});

describe("resolveDraftChannels", () => {
  it("unions included chips with typed hashtags", () => {
    expect(resolveDraftChannels("ship #Launch today", ["general"]).sort()).toEqual([
      "general",
      "launch",
    ]);
  });
});
