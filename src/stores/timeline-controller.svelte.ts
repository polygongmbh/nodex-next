// Wires the authenticated session to the NDK service and the timeline store.
// Exposes commands only (start/stop/sendMessage); state lives in the stores.

import { NOSTR_KINDS } from "@/domain/nostr-kinds";
import type { ChannelFilterState } from "@/domain/channel";
import { mergeProfileContent, type ProfileEdits } from "@/domain/person";
import { classifyEvent } from "@/domain/event-to-post";
import {
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "@/domain/publish-rules";
import { startNdkService, type NdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { filterStore } from "./filters.svelte";
import { preferencesStore } from "./preferences.svelte";
import { timelineStore } from "./timeline.svelte";

class TimelineController {
  draft = $state("");
  private service: NdkService | null = null;
  private sessionPubkey: string | null = null;
  private ownProfileBase: Record<string, unknown> = {};

  start(session: StoredSession): void {
    if (this.service) return;
    this.sessionPubkey = session.pubkeyHex;
    timelineStore.initRelays(session.relayUrls);
    this.service = startNdkService(session.relayUrls, session.privateKeyHex, {
      onEvent: (event, relayUrl) => timelineStore.ingestEvent(event, relayUrl),
      onRelayStatus: (relayUrl, connected) => timelineStore.setRelayConnected(relayUrl, connected),
      onEose: () => {
        timelineStore.markHydrated();
        void this.backfillMissingProfiles();
      },
    });
  }

  /**
   * The live profile subscription is capped, so authors of old posts can slip
   * through. After content EOSE, fetch the newest kind-0 for every author and
   * mention still missing a profile.
   */
  private async backfillMissingProfiles(): Promise<void> {
    if (!this.service) return;
    const missing = new Set<string>();
    for (const post of Object.values(timelineStore.postsById)) {
      if (!timelineStore.peopleByPubkey[post.pubkey]) missing.add(post.pubkey);
      for (const mention of post.mentions) {
        if (!timelineStore.peopleByPubkey[mention]) missing.add(mention);
      }
    }
    if (missing.size === 0) return;
    const events = await this.service.fetchProfileEvents(Array.from(missing));
    for (const raw of events) {
      const classified = classifyEvent(raw, []);
      if (classified.type === "person") timelineStore.upsertPerson(classified.person);
    }
  }

  stop(): void {
    this.service?.stop();
    this.service = null;
    this.sessionPubkey = null;
    this.ownProfileBase = {};
    timelineStore.reset();
    filterStore.reset();
    this.draft = "";
  }

  /**
   * Fetch the user's existing kind-0 from the relays. The parsed content
   * becomes the merge base for publishProfile, so republishing never drops
   * fields this UI doesn't know about.
   */
  async fetchOwnProfile(): Promise<Record<string, unknown>> {
    if (!this.service || !this.sessionPubkey) return {};
    const raw = await this.service.fetchProfileEvent(this.sessionPubkey);
    if (raw) {
      try {
        this.ownProfileBase = JSON.parse(raw.content) as Record<string, unknown>;
      } catch {
        this.ownProfileBase = {};
      }
      const classified = classifyEvent(raw, []);
      if (classified.type === "person") timelineStore.upsertPerson(classified.person);
    }
    return this.ownProfileBase;
  }

  /** Channels a send would publish with: every included channel in context. */
  get draftChannels(): string[] {
    const included = Object.entries(this.effectiveChannelStates)
      .filter(([, state]) => state === "included")
      .map(([name]) => name);
    return resolveDraftChannels(this.draft, included);
  }

  /** The draft with hashtag tokens removed — what the unified bar searches for. */
  get searchText(): string {
    return this.draft.replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, " ").trim();
  }

  /**
   * Channel states for the visible feed: chip filters, plus the tags of every
   * selected topic, plus any #hashtags typed into the unified bar.
   */
  get effectiveChannelStates(): Record<string, ChannelFilterState> {
    const merged: Record<string, ChannelFilterState> = { ...filterStore.channelStates };
    for (const topicId of filterStore.selectedTopicIds) {
      const topic = preferencesStore.topics.find((candidate) => candidate.id === topicId);
      for (const tag of topic?.tags ?? []) merged[tag] = "included";
    }
    for (const channel of resolveDraftChannels(this.draft, [])) merged[channel] = "included";
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

  /**
   * Publish a kind-0 profile to every session relay (profiles are global),
   * merged into the last fetched profile so unknown fields survive.
   */
  async publishProfile(edits: ProfileEdits): Promise<void> {
    if (!this.service) throw new PublishRuleError("Not connected yet.");
    const relayUrls = timelineStore.relays.map((relay) => relay.url);
    if (relayUrls.length === 0) throw new PublishRuleError("No space is available.");
    const content = mergeProfileContent(this.ownProfileBase, edits);
    await this.service.publish({
      kind: NOSTR_KINDS.metadata,
      content: JSON.stringify(content),
      tags: [],
      relayUrls,
    });
    this.ownProfileBase = content;
  }
}

export const timelineController = new TimelineController();
