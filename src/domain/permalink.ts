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

/**
 * Inverse of buildPostPermalink: a path whose LAST segment is a 64-hex event
 * id is a permalink; the segment before it (when present) is the relay host.
 * Anything else — including the bare app root — is not a permalink.
 */
export function parsePostPermalink(
  pathname: string
): { relayHost: string | null; postId: string } | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const postId = segments[segments.length - 1] ?? "";
  if (!/^[0-9a-f]{64}$/.test(postId)) return null;
  const relayHost = segments.length > 1 ? segments[segments.length - 2] : null;
  return { relayHost, postId };
}
