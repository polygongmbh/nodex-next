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

  it("auto-targets the sole space carrying the draft's channels", () => {
    expect(resolvePublishRelay(RELAYS, null, undefined, ["two-example"]).id).toBe("two-example");
  });

  it("still forces a pick when channels span multiple connected spaces", () => {
    expect(() =>
      resolvePublishRelay(RELAYS, null, undefined, ["one-example", "two-example"])
    ).toThrow(PublishRuleError);
  });

  it("ignores channel spaces when a space is actively selected", () => {
    expect(resolvePublishRelay(RELAYS, "one-example", undefined, ["two-example"]).id).toBe(
      "one-example"
    );
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

  it("links a top-level reply with a single NIP-10 root-marked e-tag", () => {
    const parent = post();
    const tags = buildMessageTags(["general"], { parent, root: parent });
    expect(tags).toContainEqual(["e", parent.id, "", "root", parent.pubkey]);
    expect(tags).toContainEqual(["p", parent.pubkey]);
    expect(tags.filter((tag) => tag[0] === "e")).toHaveLength(1);
  });

  it("links a nested reply with root + reply e-tags and thread p-tags", () => {
    const root = post({ id: "r".repeat(64), pubkey: "a".repeat(64) });
    const parent = post({ id: "m".repeat(64), pubkey: "b".repeat(64), mentions: [root.pubkey] });
    const tags = buildMessageTags(["general"], { parent, root });
    expect(tags).toContainEqual(["e", root.id, "", "root", root.pubkey]);
    expect(tags).toContainEqual(["e", parent.id, "", "reply", parent.pubkey]);
    expect(tags).toContainEqual(["p", parent.pubkey]);
    expect(tags).toContainEqual(["p", root.pubkey]); // parent already p-tagged the root author
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
