import type { Post } from "./post";

export type ChannelFilterState = "included" | "excluded" | "neutral";

export interface Channel {
  name: string;
  postCount: number;
}

/**
 * A topic is a named, composable combination of tags — flexible contexts
 * instead of rigid sub-channels ("Nodex User Stories" = #design + #nodex).
 * Topics are SHARED: they live as addressable kind-30177 events on the relay
 * (see docs/nip-topics.md), visible to every user of that space. The primary
 * channel decides auto-selection and the topic's home in the desktop
 * sidebar; secondary channels make it cross-disciplinary. Pinned state is
 * per-user (preferences), never part of the shared event.
 */
export interface Topic {
  /** Canonical channel-set encoding (topicIdForChannels) — the identity. */
  id: string;
  name: string;
  primary: string;
  secondary: string[];
  /** Author + event id of the defining event (needed for NIP-09 deletion). */
  pubkey: string;
  eventId: string;
  createdAt: number;
}

export function topicTags(topic: Topic): string[] {
  return [topic.primary, ...topic.secondary];
}

/** Channels derived from ALL posts (unfiltered), most-used first. */
export function deriveChannels(posts: Post[]): Channel[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const channel of post.channels) {
      counts.set(channel, (counts.get(channel) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([name, postCount]) => ({ name, postCount })).sort(
    (a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name)
  );
}

/**
 * Pins are per-space: pinning a channel applies to the spaces in scope that
 * HAVE CONTENT in that channel at pin time. Returns those relay ids; when
 * none of the scoped spaces carry content, falls back to the whole scope so
 * pinning never silently no-ops.
 */
export function spacesToPinChannelFor(
  posts: Post[],
  channel: string,
  scopeRelayIds: string[]
): string[] {
  const withContent = scopeRelayIds.filter((relayId) =>
    posts.some((post) => post.channels.includes(channel) && post.relays.includes(relayId))
  );
  return withContent.length > 0 ? withContent : scopeRelayIds;
}

/**
 * Pinned channels lead (including ones with no posts yet, at count 0), the
 * rest keep their most-used-first order. Shared by the mobile chips row and
 * the desktop sidebar list.
 */
export function partitionPinnedChannels(
  channels: Channel[],
  pinnedNames: string[]
): { pinned: Channel[]; rest: Channel[] } {
  const pinnedSet = new Set(pinnedNames);
  const pinned = channels.filter((channel) => pinnedSet.has(channel.name));
  const missing = pinnedNames
    .filter((name) => !channels.some((channel) => channel.name === name))
    .map((name) => ({ name, postCount: 0 }));
  return {
    pinned: [...pinned, ...missing],
    rest: channels.filter((channel) => !pinnedSet.has(channel.name)),
  };
}

/**
 * AND semantics: the post must carry every included channel and none of the
 * excluded ones. No included channels = no positive constraint.
 */
export function postMatchesChannelFilters(
  post: Post,
  states: Record<string, ChannelFilterState>
): boolean {
  for (const [name, state] of Object.entries(states)) {
    if (state === "included" && !post.channels.includes(name)) return false;
    if (state === "excluded" && post.channels.includes(name)) return false;
  }
  return true;
}
