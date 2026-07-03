import { beforeEach, describe, expect, it } from "vitest";
import type { Topic } from "@/domain/channel";
import { filterStore } from "./filters.svelte";

const topic: Topic = {
  id: "topic-1",
  name: "CalDav Integration",
  primary: "dev",
  secondary: ["nostr"],
  pinned: true,
};

beforeEach(() => {
  filterStore.reset();
});

describe("toggleTopic", () => {
  it("auto-selects the primary channel when none is included", () => {
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual(["topic-1"]);
    expect(filterStore.channelStates.dev).toBe("included");
  });

  it("leaves channel selection alone when one is already included", () => {
    filterStore.tapChannelChip("design");
    filterStore.toggleTopic(topic);
    expect(filterStore.channelStates.dev).toBeUndefined();
    expect(filterStore.channelStates.design).toBe("included");
  });

  it("deselecting does not touch channels", () => {
    filterStore.toggleTopic(topic);
    filterStore.toggleTopic(topic);
    expect(filterStore.selectedTopicIds).toEqual([]);
    expect(filterStore.channelStates.dev).toBe("included");
  });
});
