import type { Person } from "@/domain/person";
import type { Post } from "@/domain/post";
import { foldStateUpdate, isTopLevel, type TaskStateUpdate } from "@/domain/post";
import { classifyEvent, type RawNostrEvent } from "@/domain/event-to-post";
import { postMatchesChannelFilters, type ChannelFilterState } from "@/domain/channel";
import { normalizeRelayUrl, relayDisplayName, relayUrlToId } from "@/domain/relay-identity";

export interface RelayInfo {
  id: string;
  url: string;
  name: string;
  connected: boolean;
}

export interface TimelineEntry {
  post: Post;
  replyCount: number;
}

// Folds that arrived before their target post; replayed once it lands.
const PENDING_FOLDS_CAP = 5000;

class TimelineStore {
  postsById = $state<Record<string, Post>>({});
  peopleByPubkey = $state<Record<string, Person>>({});
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
        this.ingestPerson(classified.person);
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

  private ingestPerson(person: Person): void {
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
    this.relays = [];
    this.hydrating = true;
    this.deletionsByAuthor.clear();
    this.pendingFoldsByTargetId.clear();
    this.pendingFoldsCount = 0;
  }
}

export const timelineStore = new TimelineStore();

/**
 * Top-level posts filtered by channel states AND relay scope (post.relays ∩
 * active relay unless none selected), newest first, with reply counts.
 */
export function visibleTimeline(
  postsById: Record<string, Post>,
  channelStates: Record<string, ChannelFilterState>,
  activeRelayId: string | null
): TimelineEntry[] {
  const posts = Object.values(postsById);
  const replyCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.parentId) {
      replyCounts.set(post.parentId, (replyCounts.get(post.parentId) ?? 0) + 1);
    }
  }
  return posts
    .filter(isTopLevel)
    .filter((post) => postMatchesChannelFilters(post, channelStates))
    .filter((post) => !activeRelayId || post.relays.includes(activeRelayId))
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((post) => ({ post, replyCount: replyCounts.get(post.id) ?? 0 }));
}
