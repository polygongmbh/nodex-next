// Topic event encoding (kind 30177, addressable) — the wire format specified
// in docs/nip-topics.md. `d` is a slug of the name; the FIRST `t` tag is the
// primary channel, the rest are secondary. Content may carry a description.

import { NOSTR_KINDS } from "./nostr-kinds";
import type { Topic } from "./channel";
import type { RawNostrEvent } from "./event-to-post";

export function slugifyTopicName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
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
      ["d", slugifyTopicName(name)],
      ["title", name.trim()],
      ["t", primaryTag],
      ...secondaryTags.map((tag) => ["t", tag]),
    ],
  };
}

export function parseTopicEvent(event: RawNostrEvent): Topic | null {
  const d = event.tags.find((tag) => tag[0] === "d" && tag[1])?.[1];
  const channels = event.tags
    .filter((tag) => tag[0] === "t" && tag[1]?.trim())
    .map((tag) => tag[1].trim().toLowerCase());
  if (!d || channels.length === 0) return null;
  const title = event.tags.find((tag) => tag[0] === "title" && tag[1]?.trim())?.[1];
  return {
    id: d,
    name: title?.trim() || d,
    primary: channels[0],
    secondary: Array.from(new Set(channels.slice(1))).filter((tag) => tag !== channels[0]),
    pubkey: event.pubkey,
    eventId: event.id,
    createdAt: event.created_at,
  };
}
