import type { ChannelFilterState } from "@/domain/channel";

// Sidebar-filter equivalent for the mobile timeline: channel chip states and
// the selected space. Empty space selection = "All spaces" (no relay filter),
// never "no relays".
class FilterStore {
  channelStates = $state<Record<string, ChannelFilterState>>({});
  activeRelayId = $state<string | null>(null);
  /** Thread focus (breadcrumb / reply-indicator click): show one conversation. */
  focusedPostId = $state<string | null>(null);

  focusThread(postId: string): void {
    this.focusedPostId = postId;
  }

  clearThread(): void {
    this.focusedPostId = null;
  }

  /** Exclusive include; tapping the sole included channel clears to neutral. */
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
  }
}

export const filterStore = new FilterStore();
