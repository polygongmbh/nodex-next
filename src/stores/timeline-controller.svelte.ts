// Wires the authenticated session to the NDK service and the timeline store.
// Exposes commands only (start/stop/sendMessage); state lives in the stores.

import { NOSTR_KINDS } from "@/domain/nostr-kinds";
import {
  spacesForChannels,
  spacesToPinChannelFor,
  topicTags,
  type ChannelFilterState,
  type Topic,
} from "@/domain/channel";
import {
  buildCalendarEvent,
  encodeCalendarWhen,
  type CalendarDraft,
} from "@/domain/calendar-events";
import { buildTopicEvent } from "@/domain/topic-events";
import { mergeProfileContent, type ProfileEdits } from "@/domain/person";
import { classifyEvent } from "@/domain/event-to-post";
import {
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "@/domain/publish-rules";
import { createIngestBatcher, type IngestBatcher } from "@/infrastructure/nostr/ingest-batcher";
import { startNdkService, type NdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { filterStore } from "./filters.svelte";
import { preferencesStore } from "./preferences.svelte";
import { timelineStore, type RelayInfo } from "./timeline.svelte";

class TimelineController {
  draft = $state("");
  /** A calendar event attached to the draft; when set, sending posts NIP-52. */
  calendarDraft = $state<CalendarDraft | null>(null);
  private service: NdkService | null = null;
  private batcher: IngestBatcher | null = null;
  private sessionPubkey: string | null = null;
  // Merge bases per scope: "*" = all spaces, else a relay id. Per-space
  // profiles are separate kind-0 events living only on that relay.
  private ownProfileBases = new Map<string, Record<string, unknown>>();

  start(session: StoredSession): void {
    if (this.service) return;
    this.sessionPubkey = session.pubkeyHex;
    timelineStore.initRelays(session.relayUrls);
    // The hydration backfill streams thousands of events; batching keeps the
    // reactive timeline from rebuilding per event (scroll jitter). After EOSE
    // the batcher settles into immediate pass-through for live traffic.
    const batcher = createIngestBatcher((raw, relayUrl) =>
      timelineStore.ingestEvent(raw, relayUrl)
    );
    this.batcher = batcher;
    this.service = startNdkService(session.relayUrls, session.privateKeyHex, {
      onEvent: (event, relayUrl) => batcher.push(event, relayUrl),
      onRelayStatus: (relayUrl, connected) => timelineStore.setRelayConnected(relayUrl, connected),
      onEose: () => {
        batcher.settle();
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
    this.batcher?.dispose();
    this.batcher = null;
    this.service?.stop();
    this.service = null;
    this.sessionPubkey = null;
    this.ownProfileBases.clear();
    timelineStore.reset();
    filterStore.reset();
    this.draft = "";
    this.calendarDraft = null;
  }

  setCalendarDraft(draft: CalendarDraft): void {
    this.calendarDraft = draft;
  }

  clearCalendarDraft(): void {
    this.calendarDraft = null;
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

  /** The spaces the user is currently looking at (active one, else all). */
  get scopeRelayIds(): string[] {
    return filterStore.activeRelayId
      ? [filterStore.activeRelayId]
      : timelineStore.relays.map((relay) => relay.id);
  }

  /**
   * Pins are per-space: pinning applies to the scoped spaces that have
   * content in the channel right now; unpinning removes the scoped spaces
   * from the pin.
   */
  togglePinnedChannel(name: string): void {
    const scope = this.scopeRelayIds;
    if (preferencesStore.isChannelPinned(name, scope)) {
      preferencesStore.unpinChannel(name, scope);
      return;
    }
    preferencesStore.pinChannel(
      name,
      spacesToPinChannelFor(Object.values(timelineStore.postsById), name, scope)
    );
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

  /** Connected spaces that already carry the draft's channels (candidate targets). */
  private get channelSpaceIds(): string[] {
    return spacesForChannels(
      Object.values(timelineStore.postsById),
      this.draftChannels,
      this.scopeRelayIds
    );
  }

  /**
   * Where a send would go, for the composer: a resolved single space, the
   * candidate spaces to choose from when ambiguous, or why it can't send yet.
   * Mirrors resolvePublishRelay so the preview matches the actual result.
   */
  get sendTarget():
    | { type: "noChannel" }
    | { type: "noneConnected" }
    | { type: "resolved"; relayId: string }
    | { type: "ambiguous"; candidates: RelayInfo[] } {
    if (this.draftChannels.length === 0) return { type: "noChannel" };
    if (filterStore.activeRelayId) {
      return { type: "resolved", relayId: filterStore.activeRelayId };
    }
    const connected = timelineStore.relays.filter((relay) => relay.connected);
    if (connected.length === 0) return { type: "noneConnected" };
    if (connected.length === 1) return { type: "resolved", relayId: connected[0].id };
    const ids = this.channelSpaceIds;
    const candidates = connected.filter((relay) => ids.includes(relay.id));
    if (candidates.length === 1) return { type: "resolved", relayId: candidates[0].id };
    return { type: "ambiguous", candidates: candidates.length > 1 ? candidates : connected };
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
    const channels = this.draftChannels;
    if (channels.length === 0) throw new PublishRuleError("error.needChannel");
    // Same channel-aware resolution for messages and calendar events.
    const relay = resolvePublishRelay(
      timelineStore.relays,
      filterStore.activeRelayId,
      undefined,
      this.channelSpaceIds
    );
    if (this.calendarDraft) {
      const when = encodeCalendarWhen(this.calendarDraft);
      const event = buildCalendarEvent(
        {
          title: this.calendarDraft.title,
          allDay: this.calendarDraft.allDay,
          start: when.start,
          end: when.end,
          location: this.calendarDraft.location,
          content: this.draft.trim(),
          channels,
        },
        crypto.randomUUID()
      );
      await this.service.publish({ ...event, relayUrls: [relay.url] });
      this.calendarDraft = null;
      this.draft = "";
      return relay.id;
    }
    const content = this.draft.trim();
    if (!content) throw new PublishRuleError("error.emptyMessage");
    await this.service.publish({
      kind: NOSTR_KINDS.message,
      content,
      tags: buildMessageTags(channels),
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
