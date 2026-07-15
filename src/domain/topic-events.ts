// Topic event encoding (kind 30177, addressable) — the wire format specified
// in docs/protocol.md §Shared topics. A topic is IDENTIFIED by the set of channels it
// contains: `d` is the canonical encoding of that set (sorted, deduped,
// lowercase, `+`-joined), so renaming republishes the same address and two
// definitions of the same combination converge. The FIRST `t` tag is the
// primary channel (navigation hint, not identity); the rest are secondary.

import { NOSTR_KINDS } from "./nostr-kinds";
import type { Topic } from "./channel";
import type { RawNostrEvent } from "./event-to-post";

/** Canonical topic identity for a channel set — order-insensitive. */
export function topicIdForChannels(channels: string[]): string {
  return Array.from(
    new Set(channels.map((channel) => channel.trim().toLowerCase()).filter(Boolean))
  )
    .sort()
    .join("+");
}

export function buildTopicEvent(
  name: string,
  primary: string,
  secondary: string[]
): { kind: number; content: string; tags: string[][] } {
  const primaryTag = primary.trim().toLowerCase();
  const secondaryTags = Array.from(
    new Set(secondary.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  ).filter((tag) => tag !== primaryTag);
  return {
    kind: NOSTR_KINDS.topic,
    content: "",
    tags: [
      ["d", topicIdForChannels([primaryTag, ...secondaryTags])],
      ["title", name.trim()],
      ["t", primaryTag],
      ...secondaryTags.map((tag) => ["t", tag]),
    ],
  };
}

export function parseTopicEvent(event: RawNostrEvent): Topic | null {
  const channels = event.tags
    .filter((tag) => tag[0] === "t" && tag[1]?.trim())
    .map((tag) => tag[1].trim().toLowerCase());
  if (channels.length === 0) return null;
  // Identity comes from the channel set, not from `d` — a client that wrote
  // a different `d` still groups with equivalent topics here.
  const id = topicIdForChannels(channels);
  const title = event.tags.find((tag) => tag[0] === "title" && tag[1]?.trim())?.[1];
  return {
    id,
    name: title?.trim() || channels.map((channel) => `#${channel}`).join(" "),
    primary: channels[0],
    secondary: Array.from(new Set(channels.slice(1))).filter((tag) => tag !== channels[0]),
    pubkey: event.pubkey,
    eventId: event.id,
    createdAt: event.created_at,
  };
}
