import type { Person } from "@/domain/person";
import type { Topic } from "@/domain/channel";
import { calendarAddress, type CalendarEvent } from "@/domain/calendar-events";
import type { Post } from "@/domain/post";
import { foldStateUpdate, type TaskStateUpdate } from "@/domain/post";
import { classifyEvent, type RawNostrEvent } from "@/domain/event-to-post";
import { postMatchesChannelFilters, type ChannelFilterState } from "@/domain/channel";
import { normalizeRelayUrl, relayDisplayName, relayUrlToId } from "@/domain/relay-identity";

export interface RelayInfo {
  id: string;
  url: string;
  name: string;
  connected: boolean;
}

export type TimelineItem =
  | { type: "post"; post: Post; parent?: Post; replyCount: number; timestamp: number }
  | { type: "state"; post: Post; update: TaskStateUpdate; timestamp: number }
  | { type: "calendarEvent"; event: CalendarEvent; timestamp: number };

export interface TimelineScope {
  channelStates: Record<string, ChannelFilterState>;
  activeRelayId: string | null;
  searchQuery: string;
  /** Channels picked during onboarding — the default feed scope. */
  pinnedChannels: string[];
  myPubkey: string | null;
  /** When set, show that conversation: ancestors + the post + descendants. */
  focusedPostId?: string | null;
}

// Folds that arrived before their target post; replayed once it lands.
const PENDING_FOLDS_CAP = 5000;

class TimelineStore {
  postsById = $state<Record<string, Post>>({});
  peopleByPubkey = $state<Record<string, Person>>({});
  /** Shared topics (kind 30177), keyed by slug — newest definition wins. */
  topicsById = $state<Record<string, Topic>>({});
  /** NIP-52 calendar events keyed by (pubkey, d) — newest per address wins. */
  calendarEventsByAddress = $state<Record<string, CalendarEvent>>({});
  relays = $state<RelayInfo[]>([]);
  hydrating = $state(true);

  // NIP-09: only an author's own deletions tombstone their events.
  private deletionsByAuthor = new Map<string, Set<string>>();
  private pendingFoldsByTargetId = new Map<string, TaskStateUpdate[]>();
  private pendingFoldsCount = 0;

  initRelays(relayUrls: string[]): void {
    this.relays = relayUrls
      .map(normalizeRelayUrl)
      .filter(Boolean)
      .map((url) => ({
        id: relayUrlToId(url),
        url,
        name: relayDisplayName(url),
        connected: false,
      }));
  }

  setRelayConnected(relayUrl: string, connected: boolean): void {
    const id = relayUrlToId(relayUrl);
    const relay = this.relays.find((candidate) => candidate.id === id);
    if (relay) relay.connected = connected;
  }

  markHydrated(): void {
    this.hydrating = false;
  }

  ingestEvent(raw: RawNostrEvent, relayUrl: string | undefined): void {
    // Attribution is the point — an event without a delivering relay cannot
    // be shown honestly, so it is dropped (matches the nodex ingest boundary).
    if (!relayUrl) return;
    const classified = classifyEvent(raw, [relayUrlToId(relayUrl)]);
    switch (classified.type) {
      case "post":
        this.ingestPost(classified.post);
        break;
      case "person":
        this.upsertPerson(classified.person);
        break;
      case "topic":
        this.ingestTopic(classified.topic);
        break;
      case "calendarEvent":
        this.ingestCalendarEvent(classified.event);
        break;
      case "state":
        this.applyStateUpdate(classified.targetId, classified.update);
        break;
      case "deletion":
        this.applyDeletion(classified.byPubkey, classified.targetIds);
        break;
    }
  }

  /** Same id ⇒ same signed event: a re-ingest only carries new relay attribution. */
  private ingestPost(post: Post): void {
    if (this.deletionsByAuthor.get(post.pubkey)?.has(post.id)) return;
    const existing = this.postsById[post.id];
    if (existing) {
      const unseen = post.relays.filter((relay) => !existing.relays.includes(relay));
      if (unseen.length > 0) existing.relays.push(...unseen);
      return;
    }
    let landed = post;
    const pending = this.pendingFoldsByTargetId.get(post.id);
    if (pending) {
      for (const update of pending) landed = foldStateUpdate(landed, update);
      this.pendingFoldsCount -= pending.length;
      this.pendingFoldsByTargetId.delete(post.id);
    }
    this.postsById[landed.id] = landed;
  }

  /**
   * Topics are relay-communal: the newest definition per slug wins across
   * ALL authors, so anyone on the space can refine a topic.
   */
  private ingestTopic(topic: Topic): void {
    if (this.deletionsByAuthor.get(topic.pubkey)?.has(topic.eventId)) return;
    const existing = this.topicsById[topic.id];
    if (existing && existing.createdAt >= topic.createdAt) return;
    this.topicsById[topic.id] = topic;
  }

  get topics(): Topic[] {
    return Object.values(this.topicsById).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Same event id from another relay only adds attribution; else newest per (pubkey, d). */
  private ingestCalendarEvent(event: CalendarEvent): void {
    if (this.deletionsByAuthor.get(event.pubkey)?.has(event.eventId)) return;
    const address = calendarAddress(event);
    const existing = this.calendarEventsByAddress[address];
    if (existing && existing.eventId === event.eventId) {
      const unseen = event.relays.filter((relay) => !existing.relays.includes(relay));
      if (unseen.length > 0) existing.relays.push(...unseen);
      return;
    }
    if (existing && existing.createdAt >= event.createdAt) return;
    this.calendarEventsByAddress[address] = event;
  }

  /** Newest kind-0 wins. Public so one-shot profile fetches can land too. */
  upsertPerson(person: Person): void {
    const existing = this.peopleByPubkey[person.pubkey];
    if (existing && existing.metadataTimestamp >= person.metadataTimestamp) return;
    this.peopleByPubkey[person.pubkey] = person;
  }

  private applyStateUpdate(targetId: string, update: TaskStateUpdate): void {
    const post = this.postsById[targetId];
    if (!post) {
      const bucket = this.pendingFoldsByTargetId.get(targetId) ?? [];
      bucket.push(update);
      this.pendingFoldsByTargetId.set(targetId, bucket);
      this.pendingFoldsCount += 1;
      this.trimPendingFolds();
      return;
    }
    this.postsById[targetId] = foldStateUpdate(post, update);
  }

  private applyDeletion(byPubkey: string, targetIds: string[]): void {
    let tombstones = this.deletionsByAuthor.get(byPubkey);
    if (!tombstones) {
      tombstones = new Set();
      this.deletionsByAuthor.set(byPubkey, tombstones);
    }
    for (const targetId of targetIds) {
      tombstones.add(targetId);
      const existing = this.postsById[targetId];
      if (existing && existing.pubkey === byPubkey) {
        delete this.postsById[targetId];
      }
      for (const topic of Object.values(this.topicsById)) {
        if (topic.eventId === targetId && topic.pubkey === byPubkey) {
          delete this.topicsById[topic.id];
        }
      }
      for (const [address, calendarEvent] of Object.entries(this.calendarEventsByAddress)) {
        if (calendarEvent.eventId === targetId && calendarEvent.pubkey === byPubkey) {
          delete this.calendarEventsByAddress[address];
        }
      }
      const pending = this.pendingFoldsByTargetId.get(targetId);
      if (pending) {
        this.pendingFoldsCount -= pending.length;
        this.pendingFoldsByTargetId.delete(targetId);
      }
    }
  }

  private trimPendingFolds(): void {
    while (this.pendingFoldsCount > PENDING_FOLDS_CAP && this.pendingFoldsByTargetId.size > 0) {
      const oldestKey = this.pendingFoldsByTargetId.keys().next().value;
      if (oldestKey === undefined) break;
      this.pendingFoldsCount -= this.pendingFoldsByTargetId.get(oldestKey)?.length ?? 0;
      this.pendingFoldsByTargetId.delete(oldestKey);
    }
  }

  reset(): void {
    this.postsById = {};
    this.peopleByPubkey = {};
    this.topicsById = {};
    this.calendarEventsByAddress = {};
    this.relays = [];
    this.hydrating = true;
    this.deletionsByAuthor.clear();
    this.pendingFoldsByTargetId.clear();
    this.pendingFoldsCount = 0;
  }
}

export const timelineStore = new TimelineStore();

/**
 * The full timeline: post cards (replies included, with parent context) plus
 * compact rows for task state updates, newest first. Scope rules:
 * - relay: post.relays ∩ active relay, unless "All spaces"
 * - channels: explicit include/exclude states (AND semantics); with NO
 *   includes, pinned channels form the default scope — a post shows when it
 *   carries a pinned channel, mentions the user, or is the user's own
 * - search: case-insensitive substring over the post content (state rows also
 *   match on their update label)
 */
export function buildTimeline(
  postsById: Record<string, Post>,
  calendarEventsByAddress: Record<string, CalendarEvent>,
  scope: TimelineScope
): TimelineItem[] {
  const posts = Object.values(postsById);
  const replyCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.parentId) {
      replyCounts.set(post.parentId, (replyCounts.get(post.parentId) ?? 0) + 1);
    }
  }

  const hasIncludes = Object.values(scope.channelStates).includes("included");
  const query = scope.searchQuery.trim().toLowerCase();
  // Thread focus shows the whole conversation regardless of channel scope:
  // the focused post, its ancestors, and every descendant.
  const threadIds = scope.focusedPostId
    ? collectThreadIds(postsById, posts, scope.focusedPostId)
    : null;

  // Shared across posts and calendar events (both carry relays/channels/pubkey);
  // calendar events have no mentions and never belong to a focused thread.
  const inScope = (item: {
    id: string;
    relays: string[];
    channels: string[];
    mentions: string[];
    pubkey: string;
  }): boolean => {
    if (scope.activeRelayId && !item.relays.includes(scope.activeRelayId)) return false;
    if (threadIds) return threadIds.has(item.id);
    if (!postMatchesChannelFilters(item, scope.channelStates)) return false;
    if (!hasIncludes && scope.pinnedChannels.length > 0) {
      const pinned = scope.pinnedChannels.some((channel) => item.channels.includes(channel));
      const mentionsMe = scope.myPubkey ? item.mentions.includes(scope.myPubkey) : false;
      const mine = scope.myPubkey !== null && item.pubkey === scope.myPubkey;
      if (!pinned && !mentionsMe && !mine) return false;
    }
    return true;
  };

  const items: TimelineItem[] = [];
  for (const post of posts) {
    if (!inScope(post)) continue;
    const contentMatches = !query || post.content.toLowerCase().includes(query);
    if (contentMatches) {
      items.push({
        type: "post",
        post,
        parent: post.parentId ? postsById[post.parentId] : undefined,
        replyCount: replyCounts.get(post.id) ?? 0,
        timestamp: post.timestamp,
      });
    }
    for (const update of post.stateUpdates) {
      if (!contentMatches && !update.content.toLowerCase().includes(query)) continue;
      items.push({ type: "state", post, update, timestamp: update.timestamp });
    }
  }
  for (const event of Object.values(calendarEventsByAddress)) {
    if (threadIds) continue;
    if (!inScope({ ...event, mentions: [], id: event.eventId })) continue;
    const haystack = `${event.title}\n${event.content}\n${event.location ?? ""}`.toLowerCase();
    if (query && !haystack.includes(query)) continue;
    items.push({ type: "calendarEvent", event, timestamp: event.createdAt });
  }
  // Chat orientation: oldest at the top, newest at the bottom. On ties the
  // task card comes before its state row (the update follows the task).
  return items.sort(
    (a, b) => a.timestamp - b.timestamp || (a.type === "post" ? -1 : 1) - (b.type === "post" ? -1 : 1)
  );
}

function collectThreadIds(
  postsById: Record<string, Post>,
  posts: Post[],
  focusedId: string
): Set<string> {
  const ids = new Set<string>([focusedId]);
  let ancestor = postsById[focusedId]?.parentId;
  while (ancestor && !ids.has(ancestor)) {
    ids.add(ancestor);
    ancestor = postsById[ancestor]?.parentId;
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const post of posts) {
      if (post.parentId && ids.has(post.parentId) && !ids.has(post.id)) {
        ids.add(post.id);
        grew = true;
      }
    }
  }
  return ids;
}
