import { topicTags, type ChannelFilterState, type Topic } from "@/domain/channel";

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
   * A selected topic already scopes the feed to ALL of its tags (see the
   * controller's effectiveChannelStates), which drives the active-channel
   * highlight in the chips row. Because channel filters are AND, any channel
   * included OUTSIDE the topic would narrow the feed to nothing — so selecting
   * a topic drops such includes, keeping only excludes and the topic's own
   * tags. Deselecting leaves the channel selection untouched.
   */
  toggleTopic(topic: Topic): void {
    const selecting = !this.selectedTopicIds.includes(topic.id);
    if (!selecting) {
      this.selectedTopicIds = this.selectedTopicIds.filter((topicId) => topicId !== topic.id);
      return;
    }
    const tags = new Set(topicTags(topic));
    const next: Record<string, ChannelFilterState> = {};
    for (const [channel, state] of Object.entries(this.channelStates)) {
      if (state === "excluded") next[channel] = "excluded";
      else if (state === "included" && tags.has(channel)) next[channel] = "included";
    }
    this.channelStates = next;
    this.selectedTopicIds = [...this.selectedTopicIds, topic.id];
  }

  focusThread(postId: string): void {
    this.focusedPostId = postId;
  }

  clearThread(): void {
    this.focusedPostId = null;
  }

  /**
   * Exclusive include: a tap makes this the only included channel and SWITCHES
   * the context — any selected topics are dropped, never stacked. A tap only
   * clears back to neutral when the channel is the SOLE active thing: it is the
   * lone include AND no topic is selected. With a topic active, its tags also
   * count as active, so tapping one of them first commits to that single
   * channel (dropping the topic) rather than deselecting.
   */
  tapChannelChip(name: string): void {
    const wasOnlyIncluded =
      this.channelStates[name] === "included" &&
      this.selectedTopicIds.length === 0 &&
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
