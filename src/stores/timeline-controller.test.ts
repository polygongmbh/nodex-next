import { beforeEach, describe, expect, it } from "vitest";
import { timelineController } from "./timeline-controller.svelte";
import { timelineStore } from "./timeline.svelte";
import { filterStore } from "./filters.svelte";
import { rawEvent } from "@/test/fixtures";

const RELAY_A = "wss://one.example/";
const RELAY_B = "wss://two.example/";

beforeEach(() => {
  timelineStore.reset();
  filterStore.reset();
  timelineController.draft = "";
  timelineController.clearCalendarDraft();
  timelineStore.initRelays([RELAY_A, RELAY_B]);
  timelineStore.setRelayConnected(RELAY_A, true);
  timelineStore.setRelayConnected(RELAY_B, true);
});

// The composer's context-aware send: it only forces a space pick when the
// draft's channels genuinely span more than one space.
describe("sendTarget", () => {
  it("has no target until the draft carries a channel", () => {
    timelineController.draft = "just typing";
    expect(timelineController.sendTarget.type).toBe("noChannel");
  });

  it("auto-resolves to the sole space carrying the channel (no prompt)", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineController.draft = "hello #dev";
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "one-example" });
  });

  it("is ambiguous when the channel exists on multiple spaces", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_B);
    timelineController.draft = "hello #dev";
    const target = timelineController.sendTarget;
    expect(target.type).toBe("ambiguous");
    if (target.type === "ambiguous") {
      expect(target.candidates.map((relay) => relay.id).sort()).toEqual([
        "one-example",
        "two-example",
      ]);
    }
  });

  it("honors an actively selected space over channel membership", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_B);
    filterStore.selectSpace("two-example");
    timelineController.draft = "hello #dev";
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "two-example" });
  });
});
