// Wires the authenticated session to the NDK service and the timeline store.
// Exposes commands only (start/stop/sendMessage); state lives in the stores.

import { NOSTR_KINDS } from "@/domain/nostr-kinds";
import { topicTags, type ChannelFilterState, type Topic } from "@/domain/channel";
import { buildTopicEvent } from "@/domain/topic-events";
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
import { timelineStore } from "./timeline.svelte";

class TimelineController {
  draft = $state("");
  private service: NdkService | null = null;
  private sessionPubkey: string | null = null;
  // Merge bases per scope: "*" = all spaces, else a relay id. Per-space
  // profiles are separate kind-0 events living only on that relay.
  private ownProfileBases = new Map<string, Record<string, unknown>>();

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
    this.ownProfileBases.clear();
    timelineStore.reset();
    filterStore.reset();
    this.draft = "";
  }

  private relayUrlsForScope(relayId?: string): string[] {
    const relays = relayId
      ? timelineStore.relays.filter((relay) => relay.id === relayId)
      : timelineStore.relays;
    return relays.map((relay) => relay.url);
  }

  /**
   * Fetch the user's existing kind-0 — from one space when relayId is given,
   * across all spaces otherwise. The parsed content becomes the merge base
   * for publishProfile, so republishing never drops fields this UI doesn't
   * know about.
   */
  async fetchOwnProfile(relayId?: string): Promise<Record<string, unknown>> {
    if (!this.service || !this.sessionPubkey) return {};
    const scopeKey = relayId ?? "*";
    const raw = await this.service.fetchProfileEvent(
      this.sessionPubkey,
      relayId ? this.relayUrlsForScope(relayId) : undefined
    );
    if (raw) {
      let base: Record<string, unknown> = {};
      try {
        base = JSON.parse(raw.content) as Record<string, unknown>;
      } catch {
        base = {};
      }
      this.ownProfileBases.set(scopeKey, base);
      const classified = classifyEvent(raw, []);
      if (classified.type === "person") timelineStore.upsertPerson(classified.person);
    }
    return this.ownProfileBases.get(scopeKey) ?? this.ownProfileBases.get("*") ?? {};
  }

  /** Tear down and reconnect — used when the session's spaces change. */
  restart(session: StoredSession): void {
    this.stop();
    this.start(session);
  }

  /**
   * Publish a shared topic definition (kind 30177) — to the active space,
   * else to every connected relay, so the whole space sees it.
   */
  async createTopic(name: string, primary: string, secondary: string[]): Promise<void> {
    if (!this.service) throw new PublishRuleError("error.notConnected");
    const event = buildTopicEvent(name, primary, secondary);
    await this.service.publish({ ...event, relayUrls: this.topicRelayUrls() });
  }

  /** NIP-09 delete of an own topic definition. */
  async deleteTopic(topic: Topic): Promise<void> {
    if (!this.service || topic.pubkey !== this.sessionPubkey) {
      throw new PublishRuleError("error.notConnected");
    }
    await this.service.publish({
      kind: NOSTR_KINDS.deletion,
      content: "",
      tags: [
        ["e", topic.eventId],
        ["a", `${NOSTR_KINDS.topic}:${topic.pubkey}:${topic.id}`],
      ],
      relayUrls: this.topicRelayUrls(),
    });
  }

  private topicRelayUrls(): string[] {
    if (filterStore.activeRelayId) {
      const active = timelineStore.relays.find(
        (relay) => relay.id === filterStore.activeRelayId
      );
      if (active) return [active.url];
    }
    const connected = timelineStore.relays.filter((relay) => relay.connected);
    const targets = connected.length > 0 ? connected : timelineStore.relays;
    if (targets.length === 0) throw new PublishRuleError("error.noSpaceAvailable");
    return targets.map((relay) => relay.url);
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
      const topic = timelineStore.topicsById[topicId];
      if (topic) for (const tag of topicTags(topic)) merged[tag] = "included";
    }
    for (const channel of resolveDraftChannels(this.draft, [])) merged[channel] = "included";
    return merged;
  }

  /**
   * Publish the draft as a kind-1 message. Returns the target relay id.
   * Throws PublishRuleError with a user-readable message on rule violations.
   */
  async sendMessage(): Promise<string> {
    if (!this.service) throw new PublishRuleError("error.notConnected");
    const content = this.draft.trim();
    if (!content) throw new PublishRuleError("error.emptyMessage");
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
   * Publish a kind-0 profile — to one space when relayId is given, to every
   * session relay otherwise — merged into the last fetched profile for that
   * scope so unknown fields survive.
   */
  async publishProfile(edits: ProfileEdits, relayId?: string): Promise<void> {
    if (!this.service) throw new PublishRuleError("error.notConnected");
    const relayUrls = this.relayUrlsForScope(relayId);
    if (relayUrls.length === 0) throw new PublishRuleError("error.noSpaceAvailable");
    const scopeKey = relayId ?? "*";
    const base =
      this.ownProfileBases.get(scopeKey) ?? this.ownProfileBases.get("*") ?? {};
    const content = mergeProfileContent(base, edits);
    await this.service.publish({
      kind: NOSTR_KINDS.metadata,
      content: JSON.stringify(content),
      tags: [],
      relayUrls,
    });
    this.ownProfileBases.set(scopeKey, content);
  }
}

export const timelineController = new TimelineController();
