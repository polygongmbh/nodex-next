import type { ChannelFilterState, Topic } from "@/domain/channel";

// Sidebar-filter equivalent for the mobile timeline: channel chip states and
// the selected space. Empty space selection = "All spaces" (no relay filter),
// never "no relays".
class FilterStore {
  channelStates = $state<Record<string, ChannelFilterState>>({});
  activeRelayId = $state<string | null>(null);
  /** Thread focus (breadcrumb / reply-indicator click): show one conversation. */
  focusedPostId = $state<string | null>(null);
  /** Selected topics compose with channels: all their tags become includes. */
  selectedTopicIds = $state<string[]>([]);

  /**
   * Selecting a (pinned) topic while no channel is included auto-selects its
   * primary channel, so its sibling topics unfold and the context is visible.
   */
  toggleTopic(topic: Topic): void {
    const selecting = !this.selectedTopicIds.includes(topic.id);
    this.selectedTopicIds = selecting
      ? [...this.selectedTopicIds, topic.id]
      : this.selectedTopicIds.filter((topicId) => topicId !== topic.id);
    if (selecting && !Object.values(this.channelStates).includes("included")) {
      this.channelStates = { ...this.channelStates, [topic.primary]: "included" };
    }
  }

  focusThread(postId: string): void {
    this.focusedPostId = postId;
  }

  clearThread(): void {
    this.focusedPostId = null;
  }

  /**
   * Exclusive include; tapping the sole included channel clears to neutral.
   * Selecting a channel SWITCHES the context — any selected topics are
   * dropped, never stacked. (Selecting a topic on top of a channel still
   * composes; see toggleTopic.)
   */
  tapChannelChip(name: string): void {
    const wasOnlyIncluded =
      this.channelStates[name] === "included" &&
      Object.values(this.channelStates).filter((state) => state === "included").length === 1;
    const next: Record<string, ChannelFilterState> = {};
    for (const [channel, state] of Object.entries(this.channelStates)) {
      if (state === "excluded") next[channel] = "excluded";
    }
    if (!wasOnlyIncluded) next[name] = "included";
    this.channelStates = next;
    this.selectedTopicIds = [];
  }

  setChannelState(name: string, state: ChannelFilterState): void {
    if (state === "neutral") {
      const { [name]: _dropped, ...rest } = this.channelStates;
      this.channelStates = rest;
      return;
    }
    this.channelStates = { ...this.channelStates, [name]: state };
  }

  selectSpace(relayId: string | null): void {
    this.activeRelayId = relayId;
  }

  clearChannels(): void {
    this.channelStates = {};
  }

  get includedChannels(): string[] {
    return Object.entries(this.channelStates)
      .filter(([, state]) => state === "included")
      .map(([name]) => name);
  }

  reset(): void {
    this.channelStates = {};
    this.activeRelayId = null;
    this.focusedPostId = null;
    this.selectedTopicIds = [];
  }
}

export const filterStore = new FilterStore();
