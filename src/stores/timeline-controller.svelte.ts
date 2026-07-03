// Wires the authenticated session to the NDK service and the timeline store.
// Exposes commands only (start/stop/sendMessage); state lives in the stores.

import { NOSTR_KINDS } from "@/domain/nostr-kinds";
import type { ChannelFilterState } from "@/domain/channel";
import {
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "@/domain/publish-rules";
import { startNdkService, type NdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { filterStore } from "./filters.svelte";
import { timelineStore } from "./timeline.svelte";

class TimelineController {
  draft = $state("");
  private service: NdkService | null = null;

  start(session: StoredSession): void {
    if (this.service) return;
    timelineStore.initRelays(session.relayUrls);
    this.service = startNdkService(session.relayUrls, session.privateKeyHex, {
      onEvent: (event, relayUrl) => timelineStore.ingestEvent(event, relayUrl),
      onRelayStatus: (relayUrl, connected) => timelineStore.setRelayConnected(relayUrl, connected),
      onEose: () => timelineStore.markHydrated(),
    });
  }

  stop(): void {
    this.service?.stop();
    this.service = null;
    timelineStore.reset();
    filterStore.reset();
    this.draft = "";
  }

  get draftChannels(): string[] {
    return resolveDraftChannels(this.draft, filterStore.includedChannels);
  }

  /** The draft with hashtag tokens removed — what the unified bar searches for. */
  get searchText(): string {
    return this.draft.replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, " ").trim();
  }

  /**
   * Channel states for the visible feed: the chip filters plus any #hashtags
   * typed into the unified bar, which scope the feed while composing.
   */
  get effectiveChannelStates(): Record<string, ChannelFilterState> {
    const typed = resolveDraftChannels(this.draft, []);
    if (typed.length === 0) return filterStore.channelStates;
    const merged: Record<string, ChannelFilterState> = { ...filterStore.channelStates };
    for (const channel of typed) merged[channel] = "included";
    return merged;
  }

  /**
   * Publish the draft as a kind-1 message. Returns the target relay id.
   * Throws PublishRuleError with a user-readable message on rule violations.
   */
  async sendMessage(): Promise<string> {
    if (!this.service) throw new PublishRuleError("Not connected yet.");
    const content = this.draft.trim();
    if (!content) throw new PublishRuleError("Write a message first.");
    const channels = this.draftChannels;
    const tags = buildMessageTags(channels);
    const relay = resolvePublishRelay(timelineStore.relays, filterStore.activeRelayId);
    await this.service.publish({
      kind: NOSTR_KINDS.message,
      content,
      tags,
      relayUrls: [relay.url],
    });
    this.draft = "";
    return relay.id;
  }

  /** Publish a kind-0 profile to every session relay (profiles are global). */
  async publishProfile(profile: {
    name?: string;
    displayName: string;
    about?: string;
    picture?: string;
  }): Promise<void> {
    if (!this.service) throw new PublishRuleError("Not connected yet.");
    const relayUrls = timelineStore.relays.map((relay) => relay.url);
    if (relayUrls.length === 0) throw new PublishRuleError("No space is available.");
    const content: Record<string, string> = { display_name: profile.displayName };
    if (profile.name) content.name = profile.name;
    if (profile.about?.trim()) content.about = profile.about.trim();
    if (profile.picture) content.picture = profile.picture;
    await this.service.publish({
      kind: NOSTR_KINDS.metadata,
      content: JSON.stringify(content),
      tags: [],
      relayUrls,
    });
  }
}

export const timelineController = new TimelineController();
