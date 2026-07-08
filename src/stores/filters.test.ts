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
  it("selects the topic without forcing a channel include (its tags drive the feed)", () => {
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([topic.id]);
    expect(filterStore.channelStates).toEqual({});
  });

  it("clears an included channel that is not one of the topic's tags", () => {
    filterStore.tapChannelChip("design");
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([topic.id]);
    expect(filterStore.channelStates.design).toBeUndefined();
  });

  it("keeps an included channel that IS one of the topic's tags", () => {
    filterStore.tapChannelChip("dev");
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([topic.id]);
    expect(filterStore.channelStates.dev).toBe("included");
  });

  it("preserves excluded channels when a topic is selected", () => {
    filterStore.setChannelState("design", "excluded");
    filterStore.toggleTopic(topic);
    expect(filterStore.channelStates.design).toBe("excluded");
  });

  it("deselecting a topic leaves the channel selection untouched", () => {
    filterStore.tapChannelChip("dev");
    filterStore.toggleTopic(topic);
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([]);
    expect(filterStore.channelStates.dev).toBe("included");
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

  it("tapping a topic's channel activates that channel and drops the topic", () => {
    filterStore.toggleTopic(topic); // dev is active via the topic, not via channelStates
    filterStore.tapChannelChip("dev");
    expect(filterStore.selectedTopicIds).toEqual([]);
    expect(filterStore.channelStates.dev).toBe("included");
  });

  it("only clears to neutral when the channel is the sole active thing", () => {
    filterStore.tapChannelChip("dev");
    // dev is the lone include and no topic is selected — a second tap clears it.
    filterStore.tapChannelChip("dev");
    expect(filterStore.channelStates.dev).toBeUndefined();
    expect(filterStore.includedChannels).toEqual([]);
  });
});
