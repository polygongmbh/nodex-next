import type { Post } from "./post";

export type ChannelFilterState = "included" | "excluded" | "neutral";

export interface Channel {
  name: string;
  postCount: number;
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
