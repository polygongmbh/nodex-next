import { describe, expect, it } from "vitest";
import { resolveRelayIcon } from "./relay-icon";

describe("resolveRelayIcon", () => {
  it("maps known host prefixes to their glyph", () => {
    expect(resolveRelayIcon("wss://feed.example.com")).toBe("rss");
    expect(resolveRelayIcon("wss://tasks.your-org.example")).toBe("list");
    expect(resolveRelayIcon("wss://relay.damus.io")).toBe("tower");
    expect(resolveRelayIcon("nostr.wine")).toBe("cpu");
  });

  it("falls back to a deterministic glyph for unknown prefixes", () => {
    const first = resolveRelayIcon("wss://mostr.pub");
    expect(first).toBe(resolveRelayIcon("wss://mostr.pub"));
    expect(["building", "users", "game", "cpu", "radio"]).toContain(first);
  });

  it("is stable across url variants of the same host", () => {
    expect(resolveRelayIcon("wss://one.example/")).toBe(resolveRelayIcon("one.example"));
  });

  it("resolves an id-like seed without a scheme", () => {
    expect(resolveRelayIcon("feed-example-com")).toBe(resolveRelayIcon("feed-example-com"));
  });
});
