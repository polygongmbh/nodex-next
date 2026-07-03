import type { Post } from "./post";

export type ChannelFilterState = "included" | "excluded" | "neutral";

export interface Channel {
  name: string;
  postCount: number;
}

/**
 * A topic is a named, composable combination of tags — flexible contexts
 * instead of rigid sub-channels ("Nodex User Stories" = #design + #nodex).
 * The primary channel is where the topic lives (it renders as a subitem of
 * that channel); secondary channels make it cross-disciplinary. Selecting a
 * topic includes all its tags; topics and channels compose.
 */
export interface Topic {
  id: string;
  name: string;
  primary: string;
  secondary: string[];
  pinned: boolean;
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
