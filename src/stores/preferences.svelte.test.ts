import { beforeEach, describe, expect, it } from "vitest";
import { preferencesStore } from "./preferences.svelte";

beforeEach(() => {
  preferencesStore.reset();
});

describe("confirmOnboarded", () => {
  it("marks the account onboarded", () => {
    expect(preferencesStore.onboarded).toBe(false);
    preferencesStore.confirmOnboarded();
    expect(preferencesStore.onboarded).toBe(true);
  });

  it("leaves pinnedChannels and pinnedTopics untouched", () => {
    preferencesStore.pinnedChannels = { dev: ["relay-a"] };
    preferencesStore.pinnedTopics = ["caldav-integration"];
    preferencesStore.confirmOnboarded();
    expect(preferencesStore.pinnedChannels).toEqual({ dev: ["relay-a"] });
    expect(preferencesStore.pinnedTopics).toEqual(["caldav-integration"]);
  });
});
