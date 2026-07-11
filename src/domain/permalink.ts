// Shareable post links, route-compatible with the original nodex app:
// <origin>/<relayHost>/<eventId>, the relay segment omitted when unknown.

import { normalizeRelayUrl } from "./relay-identity";

export interface PermalinkRelay {
  id: string;
  url: string;
}

/**
 * Permalink for a post: prefers the active space when it delivered the post,
 * else the post's origin relay (first attribution), else no relay segment.
 */
export function buildPostPermalink(
  origin: string,
  postId: string,
  postRelayIds: string[],
  relays: PermalinkRelay[],
  activeRelayId: string | null
): string {
  const base = origin.replace(/\/+$/, "");
  const known = postRelayIds
    .map((id) => relays.find((relay) => relay.id === id))
    .filter((relay): relay is PermalinkRelay => Boolean(relay));
  const preferred = known.find((relay) => relay.id === activeRelayId) ?? known[0];
  const normalized = preferred ? normalizeRelayUrl(preferred.url) : "";
  if (!normalized) return `${base}/${postId}`;
  const host = new URL(normalized).hostname;
  return `${base}/${encodeURIComponent(host)}/${postId}`;
}
