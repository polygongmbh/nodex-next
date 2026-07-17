import { describe, expect, it } from "vitest";
import { shouldResync } from "./wake-watcher";

// The decision half of the wake watcher: which browser signals warrant tearing
// down and rebuilding the relay service.
describe("shouldResync", () => {
  it("always resyncs when the network comes back", () => {
    expect(shouldResync({ type: "online" }, false)).toBe(true);
    expect(shouldResync({ type: "online" }, true)).toBe(true);
  });

  it("resyncs a re-shown tab when a relay is offline", () => {
    expect(shouldResync({ type: "visible", hiddenMs: 5_000 }, true)).toBe(true);
  });

  it("skips a brief tab switch with all relays healthy", () => {
    expect(shouldResync({ type: "visible", hiddenMs: 5_000 }, false)).toBe(false);
  });

  it("resyncs a long-hidden tab even when sockets look healthy", () => {
    // Subscriptions can be dead while the relay status still shows connected —
    // NDK never re-REQs a RUNNING subscription after an internal reconnect.
    expect(shouldResync({ type: "visible", hiddenMs: 120_000 }, false)).toBe(true);
  });

  it("resyncs when the watchdog tick arrives late (system slept)", () => {
    expect(shouldResync({ type: "tick", gapMs: 200_000 }, false)).toBe(true);
    expect(shouldResync({ type: "tick", gapMs: 31_000 }, false)).toBe(false);
  });
});
