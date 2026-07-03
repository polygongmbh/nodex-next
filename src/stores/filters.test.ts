import { beforeEach, describe, expect, it } from "vitest";
import type { Topic } from "@/domain/channel";
import { filterStore } from "./filters.svelte";

const topic: Topic = {
  id: "caldav-integration",
  name: "CalDav Integration",
  primary: "dev",
  secondary: ["nostr"],
  pubkey: "a".repeat(64),
  eventId: "e".repeat(64),
  createdAt: 100,
};

beforeEach(() => {
  filterStore.reset();
});

describe("toggleTopic", () => {
  it("auto-selects the primary channel when none is included", () => {
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([topic.id]);
    expect(filterStore.channelStates.dev).toBe("included");
  });

  it("leaves channel selection alone when one is already included", () => {
    filterStore.tapChannelChip("design");
    filterStore.toggleTopic(topic);
    expect(filterStore.channelStates.dev).toBeUndefined();
    expect(filterStore.channelStates.design).toBe("included");
  });
});

describe("tapChannelChip", () => {
  it("switches over from a selected topic instead of stacking", () => {
    filterStore.toggleTopic(topic);
    filterStore.tapChannelChip("design");
    expect(filterStore.selectedTopicIds).toEqual([]);
    expect(filterStore.channelStates.design).toBe("included");
    expect(filterStore.channelStates.dev).toBeUndefined();
  });
});
