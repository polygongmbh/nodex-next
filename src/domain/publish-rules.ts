// Publish rules ported from nodex/SPEC: a post MUST carry ≥1 channel, and new
// posts target exactly one relay — the single active relay, else the sole
// connected relay, else it's an error. Replies pin to the parent's origin relay.

import type { Post } from "./post";
import { extractHashtagsFromContent } from "./hashtags";

export class PublishRuleError extends Error {}

export interface PublishRelayCandidate {
  id: string;
  url: string;
  connected: boolean;
}

/** Channels a draft would publish with: included filter chips ∪ typed #hashtags. */
export function resolveDraftChannels(content: string, includedChannels: string[]): string[] {
  const channels = new Set(includedChannels.map((channel) => channel.toLowerCase()));
  for (const hashtag of extractHashtagsFromContent(content)) {
    channels.add(hashtag);
  }
  return Array.from(channels);
}

export function resolvePublishRelay(
  relays: PublishRelayCandidate[],
  activeRelayId: string | null,
  parent?: Post,
  candidateSpaceIds?: string[]
): PublishRelayCandidate {
  if (parent) {
    const originId = parent.relays[0];
    const origin = relays.find((relay) => relay.id === originId);
    if (origin) return origin;
    throw new PublishRuleError("error.parentSpaceUnavailable");
  }
  if (activeRelayId) {
    const active = relays.find((relay) => relay.id === activeRelayId);
    if (active) return active;
    throw new PublishRuleError("error.spaceUnavailable");
  }
  const connected = relays.filter((relay) => relay.connected);
  if (connected.length === 0) throw new PublishRuleError("error.noSpaceConnected");
  if (connected.length === 1) return connected[0];
  // No active space and several connected: derive the target from where the
  // draft's channels live. Exactly one candidate space is unambiguous; zero or
  // several means the user must pick a space first.
  const candidates = candidateSpaceIds
    ? connected.filter((relay) => candidateSpaceIds.includes(relay.id))
    : [];
  if (candidates.length === 1) return candidates[0];
  throw new PublishRuleError("error.selectSpace");
}

/**
 * Every connected space that delivered the target event. Reactions and
 * deletions follow the post — they go to wherever it was seen, not to the
 * composer's single publish target.
 */
export function resolveTargetRelays(
  relays: PublishRelayCandidate[],
  targetRelayIds: string[]
): PublishRelayCandidate[] {
  const targets = relays.filter(
    (relay) => targetRelayIds.includes(relay.id) && relay.connected
  );
  if (targets.length === 0) throw new PublishRuleError("error.postSpaceUnavailable");
  return targets;
}

/** NIP-09 tags for deleting own events: an `e` per event plus deduped `k` kinds. */
export function buildDeletionTags(targets: { id: string; kind: number }[]): string[][] {
  const tags: string[][] = targets.map((target) => ["e", target.id]);
  for (const kind of new Set(targets.map((target) => target.kind))) {
    tags.push(["k", String(kind)]);
  }
  return tags;
}

/** Immediate parent + thread root of a reply (root === parent for top-level). */
export interface ReplyContext {
  parent: Post;
  root: Post;
  /** Relay URL hint for the e-tags (NIP-10 recommends it; "" when unknown). */
  relayHint?: string;
}

/**
 * Tags for a kind-1 message: every channel as a lowercased `t`-tag, plus —
 * for a reply — NIP-10 threading. A reply to the thread root carries a single
 * `root`-marked `e`-tag; a reply to a nested post carries `root` + `reply`
 * e-tags (root-first). `p`-tags notify the thread: the parent's author plus
 * everyone the parent already `p`-tagged (NIP-10 §"p" tag).
 */
export function buildMessageTags(channels: string[], reply?: ReplyContext): string[][] {
  if (channels.length === 0) {
    throw new PublishRuleError("error.needChannel");
  }
  const tags: string[][] = channels.map((channel) => ["t", channel.toLowerCase()]);
  if (reply) {
    const { parent, root, relayHint = "" } = reply;
    tags.push(["e", root.id, relayHint, "root", root.pubkey]);
    if (parent.id !== root.id) {
      tags.push(["e", parent.id, relayHint, "reply", parent.pubkey]);
    }
    const seen = new Set<string>();
    for (const pubkey of [parent.pubkey, ...parent.mentions]) {
      if (pubkey && !seen.has(pubkey)) {
        seen.add(pubkey);
        tags.push(["p", pubkey]);
      }
    }
  }
  return tags;
}
