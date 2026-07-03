import { describe, expect, it } from "vitest";
import {
  normalizeRelayUrl,
  relayColorSlot,
  relayDisplayName,
  relayUrlToId,
  RELAY_COLOR_SLOTS,
} from "./relay-identity";

describe("relay identity", () => {
  it("normalizes bare hosts to wss with trailing slash", () => {
    expect(normalizeRelayUrl("one.example")).toBe("wss://one.example/");
    expect(normalizeRelayUrl("wss://one.example")).toBe("wss://one.example/");
  });

  it("derives the same id for url variants", () => {
    expect(relayUrlToId("wss://one.example/")).toBe(relayUrlToId("one.example"));
    expect(relayUrlToId("wss://one.example/")).toBe("one-example");
  });

  it("drops common prefixes and the TLD from display names", () => {
    expect(relayDisplayName("wss://relay.polygon.example")).toBe("polygon");
    expect(relayDisplayName("wss://nostr.wine")).toBe("wine");
  });

  it("assigns stable color slots in range", () => {
    const slot = relayColorSlot("one-example");
    expect(slot).toBe(relayColorSlot("one-example"));
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(RELAY_COLOR_SLOTS);
  });
});
