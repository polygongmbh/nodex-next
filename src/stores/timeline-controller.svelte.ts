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
import {
  hasExistingProfileContent,
  mergeProfileContent,
  parseProfileContent,
  type ProfileContent,
  type ProfileEdits,
} from "@/domain/person";
import { relayUrlToId } from "@/domain/relay-identity";
import { buildReactionTags, reactionContentFor } from "@/domain/reaction-events";
import { classifyEvent, type RawNostrEvent } from "@/domain/event-to-post";
import type { Post } from "@/domain/post";
import {
  buildDeletionTags,
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
  resolveTargetRelays,
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
  /**
   * The own post being recomposed: sending publishes a replacement (same kind,
   * the original's channels and thread) and then deletes this original.
   */
  recomposeOf = $state<Post | null>(null);
  private service: NdkService | null = null;
  private batcher: IngestBatcher | null = null;
  private sessionPubkey: string | null = null;
  // Own kind-0 merge bases, keyed by scope: a relay id for a per-space profile,
  // or "*" for an all-spaces fetch/publish whose source relay is unknown. Fed
  // newest-wins by the live subscription (ingest), by fetchOwnProfile, and by
  // publishProfile — so publishProfile never republishes over a stale base and
  // the editor can open without a network round-trip. Only NON-empty content is
  // ever stored (empties would let a merge silently wipe unknown fields).
  private ownProfileBases = new Map<string, { content: ProfileContent; createdAt: number }>();

  start(session: StoredSession): void {
    if (this.service) return;
    this.sessionPubkey = session.pubkeyHex;
    timelineStore.initRelays(session.relayUrls);
    // The hydration backfill streams thousands of events; batching keeps the
    // reactive timeline from rebuilding per event (scroll jitter). After EOSE
    // the batcher settles into immediate pass-through for live traffic.
    const batcher = createIngestBatcher((raw, relayUrl) => {
      this.captureOwnProfile(raw, relayUrl);
      timelineStore.ingestEvent(raw, relayUrl);
    });
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

  /**
   * Capture the session user's own kind-0s as they flow through ingest, so the
   * live subscription primes the profile-editor merge base and most opens need
   * no fetch. Only non-empty content is recorded (never cache emptiness).
   */
  private captureOwnProfile(raw: RawNostrEvent, relayUrl: string | undefined): void {
    if (raw.kind !== NOSTR_KINDS.metadata || raw.pubkey !== this.sessionPubkey || !relayUrl) return;
    const content = parseProfileContent(raw.content);
    if (content && hasExistingProfileContent(content)) {
      this.recordOwnProfile(relayUrlToId(relayUrl), content, raw.created_at);
    }
  }

  /** Newest-wins record of an own kind-0 under a scope key (relay id or "*"). */
  private recordOwnProfile(scopeKey: string, content: ProfileContent, createdAt: number): void {
    const existing = this.ownProfileBases.get(scopeKey);
    if (existing && existing.createdAt >= createdAt) return;
    this.ownProfileBases.set(scopeKey, { content, createdAt });
  }

  /** The newest own kind-0 seen across every scope, or undefined if none. */
  private newestOwnProfile(): { content: ProfileContent; createdAt: number } | undefined {
    let newest: { content: ProfileContent; createdAt: number } | undefined;
    for (const entry of this.ownProfileBases.values()) {
      if (!newest || entry.createdAt > newest.createdAt) newest = entry;
    }
    return newest;
  }

  /**
   * The merge base for a scope: that relay's own kind-0 when present, else the
   * newest one seen across all scopes ("*" fallback), else {}.
   */
  private ownProfileBase(relayId?: string): ProfileContent {
    const scoped = relayId ? this.ownProfileBases.get(relayId) : undefined;
    return (scoped ?? this.newestOwnProfile())?.content ?? {};
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
    this.recomposeOf = null;
  }

  /**
   * Start recomposing an own post: prefill the composer with its content. On
   * send the replacement is published (inheriting the original's channels,
   * thread and origin relay), then the original is deleted.
   */
  recompose(post: Post): void {
    this.recomposeOf = post;
    this.draft = post.content;
  }

  /** Abandon a recompose: clear the marker and the prefilled draft. */
  cancelRecompose(): void {
    this.recomposeOf = null;
    this.draft = "";
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
   * The user's existing kind-0 for a scope — from one space when relayId is
   * given, across all spaces otherwise — as the merge base for publishProfile,
   * so republishing never drops fields this UI doesn't know about.
   *
   * Cache-first: a confirmed NON-empty base (from the live subscription, an
   * earlier fetch, or a publish) is returned without a network round-trip, so
   * opening the editor is instant. Emptiness is never cached — a timed-out
   * fetch is indistinguishable from a confirmed-absent profile, and merging
   * edits into a wrongly-empty base would silently wipe lud16/banner — so an
   * empty result just makes the next call fetch again.
   */
  async fetchOwnProfile(relayId?: string): Promise<ProfileContent> {
    if (!this.service || !this.sessionPubkey) return {};
    const cached = this.ownProfileBase(relayId);
    if (hasExistingProfileContent(cached)) return cached;
    const raw = await this.service.fetchProfileEvent(
      this.sessionPubkey,
      relayId ? this.relayUrlsForScope(relayId) : undefined
    );
    if (raw) {
      const content = parseProfileContent(raw.content);
      if (content && hasExistingProfileContent(content)) {
        this.recordOwnProfile(relayId ?? "*", content, raw.created_at);
        const classified = classifyEvent(raw, []);
        if (classified.type === "person") timelineStore.upsertPerson(classified.person);
      }
    }
    return this.ownProfileBase(relayId);
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

  /** The post a send would reply to: the focused thread's post, if any. */
  get replyParent(): Post | undefined {
    const id = filterStore.focusedPostId;
    return id ? timelineStore.postsById[id] : undefined;
  }

  /** Walk parentId up to the thread root (returns self when top-level). */
  private threadRoot(parent: Post): Post {
    let current = parent;
    const seen = new Set<string>([current.id]);
    while (current.parentId) {
      const next = timelineStore.postsById[current.parentId];
      if (!next || seen.has(next.id)) break;
      seen.add(next.id);
      current = next;
    }
    return current;
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
      // NIP-09 `e` + `k` from the shared builder, plus the `a` address so the
      // addressable topic is tombstoned by coordinate too.
      tags: [
        ...buildDeletionTags([{ id: topic.eventId, kind: NOSTR_KINDS.topic }]),
        ["a", `${NOSTR_KINDS.topic}:${topic.pubkey}:${topic.id}`],
      ],
      relayUrls: this.topicRelayUrls(),
    });
  }

  /**
   * NIP-09 delete of one of the user's own posts (kind 1 or 1621). Guards
   * own-authorship, then publishes a kind-5 tombstone to every connected relay
   * that delivered the post — the echo removes it locally.
   */
  async deletePost(post: Post): Promise<void> {
    if (!this.service || post.pubkey !== this.sessionPubkey) {
      throw new PublishRuleError("error.notConnected");
    }
    const relays = resolveTargetRelays(timelineStore.relays, post.relays);
    await this.service.publish({
      kind: NOSTR_KINDS.deletion,
      content: "",
      tags: buildDeletionTags([{ id: post.id, kind: post.kind }]),
      relayUrls: relays.map((relay) => relay.url),
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

  /**
   * Channels a send would publish with: typed #hashtags plus the context —
   * for a reply the parent's own channels (so it stays in the thread's
   * channels even while the chips row is hidden), otherwise every included
   * channel and selected-topic tag.
   */
  get draftChannels(): string[] {
    // A recompose inherits the original's channels; a reply the parent's — both
    // over the chip context (recompose wins over reply). This keeps the post in
    // the same channels even while the chips row is hidden.
    const contextPost = this.recomposeOf ?? this.replyParent;
    const context = contextPost
      ? contextPost.channels
      : Object.entries(this.effectiveChannelStates)
          .filter(([, state]) => state === "included")
          .map(([name]) => name);
    return resolveDraftChannels(this.draft, context);
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
    // A recompose pins to the ORIGINAL's origin relay, a reply to the parent's —
    // both override any active space (recompose wins over reply).
    const pinPost = this.recomposeOf ?? this.replyParent;
    if (pinPost) {
      const origin = timelineStore.relays.find((relay) => relay.id === pinPost.relays[0]);
      return origin ? { type: "resolved", relayId: origin.id } : { type: "noneConnected" };
    }
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
    // Same channel-aware resolution for messages and calendar events; a reply
    // pins to the focused parent's origin relay, a recompose to the ORIGINAL's
    // (recompose wins over reply) — keeping the thread on one space.
    const recompose = this.recomposeOf;
    const parent = this.replyParent;
    const relay = resolvePublishRelay(
      timelineStore.relays,
      filterStore.activeRelayId,
      recompose ?? parent,
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
    // Threading: a reply threads under its parent; a recompose reuses the
    // ORIGINAL's thread (parent + root), or none when the parent is gone.
    const threadParent = recompose
      ? recompose.parentId
        ? timelineStore.postsById[recompose.parentId]
        : undefined
      : parent;
    const reply = threadParent
      ? { parent: threadParent, root: this.threadRoot(threadParent), relayHint: relay.url }
      : undefined;
    await this.service.publish({
      kind: recompose ? recompose.kind : NOSTR_KINDS.message,
      content,
      tags: buildMessageTags(channels, reply),
      relayUrls: [relay.url],
    });
    this.draft = "";
    // A recompose deletes the original only AFTER the replacement lands. The
    // marker is cleared first so the composer resets even if the deletion
    // fails — the new post is kept and the deletion error surfaces to the bar.
    if (recompose) {
      this.recomposeOf = null;
      const targets = resolveTargetRelays(timelineStore.relays, recompose.relays);
      await this.service.publish({
        kind: NOSTR_KINDS.deletion,
        content: "",
        tags: buildDeletionTags([{ id: recompose.id, kind: recompose.kind }]),
        relayUrls: targets.map((target) => target.url),
      });
    }
    return relay.id;
  }

  /**
   * Toggle a NIP-25 reaction on a post. Reactions publish to every connected
   * relay that delivered the post (per-relay attribution), never a global
   * default. Re-reacting with the SAME emoji deletes the prior reaction (kind
   * 5); a different emoji publishes a new kind-7 (the store's newest-wins
   * replaces the old one). Optimistic echo drives the local state.
   */
  async react(post: Post, emoji: string): Promise<void> {
    if (!this.service || !this.sessionPubkey) throw new PublishRuleError("error.notConnected");
    const relays = resolveTargetRelays(timelineStore.relays, post.relays);
    const relayUrls = relays.map((relay) => relay.url);
    const mine = timelineStore.reactionsByTargetId[post.id]?.[this.sessionPubkey];
    if (mine && mine.emoji === emoji) {
      await this.service.publish({
        kind: NOSTR_KINDS.deletion,
        content: "",
        tags: buildDeletionTags([{ id: mine.id, kind: NOSTR_KINDS.reaction }]),
        relayUrls,
      });
      return;
    }
    await this.service.publish({
      kind: NOSTR_KINDS.reaction,
      content: reactionContentFor(emoji),
      tags: buildReactionTags(post, relays[0].url),
      relayUrls,
    });
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
    const content = mergeProfileContent(this.ownProfileBase(relayId), edits);
    const createdAt = Math.floor(Date.now() / 1000);
    await this.service.publish({
      kind: NOSTR_KINDS.metadata,
      content: JSON.stringify(content),
      tags: [],
      relayUrls,
    });
    this.recordOwnProfile(relayId ?? "*", content, createdAt);
  }
}

export const timelineController = new TimelineController();
