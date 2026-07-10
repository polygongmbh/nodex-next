// Boundary conversion: raw Nostr event JSON → typed domain objects. The
// stores never see raw events; every input is one of these classified shapes.

import { NOSTR_KINDS, isPostKind, isTaskStateKind } from "./nostr-kinds";
import type { Person, ProfileContent } from "./person";
import type { Post, TaskStateUpdate } from "./post";
import type { Topic } from "./channel";
import { deriveChannelTags } from "./hashtags";
import { parseAttachments } from "./attachments";
import { isCalendarKind, parseCalendarEvent, type CalendarEvent } from "./calendar-events";
import { parseTopicEvent } from "./topic-events";

export interface RawNostrEvent {
  id: string;
  pubkey: string;
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}

export type ClassifiedEvent =
  | { type: "post"; post: Post }
  | { type: "person"; person: Person }
  | { type: "topic"; topic: Topic }
  | { type: "calendarEvent"; event: CalendarEvent }
  | { type: "state"; targetId: string; update: TaskStateUpdate }
  | { type: "deletion"; byPubkey: string; targetIds: string[] }
  | { type: "ignored" };

/**
 * Immediate parent of a reply, from its `e`-tags. Precedence:
 *  1. legacy `parent` marker (nodex/mostr kind-1621 subtasks — must win so a
 *     foreign `root`/`reply` tag never shadows the task tree, see mostr's
 *     find_refs(MARKER_PARENT));
 *  2. NIP-10 `reply` marker — the direct parent of a nested reply;
 *  3. NIP-10 `root` marker — a top-level reply carries only `root`, and that
 *     root IS its parent.
 * Unmarked (deprecated positional) and `mention` e-tags are NOT parents — a
 * bare `e`-tag is treated as a citation, not a reply link.
 */
export function resolveParentId(tags: string[][]): string | undefined {
  let reply: string | undefined;
  let root: string | undefined;
  for (const tag of tags) {
    if (tag[0] !== "e" || !tag[1]) continue;
    if (tag[3] === "parent") return tag[1];
    if (tag[3] === "reply" && !reply) reply = tag[1];
    else if (tag[3] === "root" && !root) root = tag[1];
  }
  return reply ?? root;
}

function resolveMentions(tags: string[][]): string[] {
  return Array.from(
    new Set(tags.filter((tag) => (tag[0] === "p" || tag[0] === "P") && tag[1]).map((tag) => tag[1]))
  );
}

function firstEventReference(tags: string[][]): string | undefined {
  return tags.find((tag) => tag[0] === "e" && tag[1])?.[1];
}

export function classifyEvent(event: RawNostrEvent, relayIds: string[]): ClassifiedEvent {
  if (isPostKind(event.kind)) {
    return {
      type: "post",
      post: {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        content: event.content,
        channels: deriveChannelTags(event.tags, event.content),
        relays: [...relayIds],
        timestamp: event.created_at,
        parentId: resolveParentId(event.tags),
        mentions: resolveMentions(event.tags),
        attachments: parseAttachments(event.tags),
        stateUpdates: [],
      },
    };
  }

  if (isTaskStateKind(event.kind)) {
    const targetId = firstEventReference(event.tags);
    if (!targetId) return { type: "ignored" };
    return {
      type: "state",
      targetId,
      update: {
        id: event.id,
        kind: event.kind,
        content: event.content,
        pubkey: event.pubkey,
        timestamp: event.created_at,
      },
    };
  }

  if (event.kind === NOSTR_KINDS.deletion) {
    const targetIds = event.tags
      .filter((tag) => (tag[0] === "e" || tag[0] === "E") && tag[1])
      .map((tag) => tag[1]);
    if (targetIds.length === 0) return { type: "ignored" };
    return { type: "deletion", byPubkey: event.pubkey, targetIds };
  }

  if (event.kind === NOSTR_KINDS.metadata) {
    const person = parseMetadata(event);
    return person ? { type: "person", person } : { type: "ignored" };
  }

  if (event.kind === NOSTR_KINDS.topic) {
    const topic = parseTopicEvent(event);
    return topic ? { type: "topic", topic } : { type: "ignored" };
  }

  if (isCalendarKind(event.kind)) {
    const calendarEvent = parseCalendarEvent(event, relayIds);
    return calendarEvent ? { type: "calendarEvent", event: calendarEvent } : { type: "ignored" };
  }

  return { type: "ignored" };
}

function parseMetadata(event: RawNostrEvent): Person | null {
  // Keep the whole decoded object verbatim — trimmed/coerced fields are read
  // on demand (person.ts accessors), so unknown keys (lud16, banner, …) survive.
  let profile: unknown;
  try {
    profile = JSON.parse(event.content);
  } catch {
    return null;
  }
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) return null;
  return {
    pubkey: event.pubkey,
    metadataTimestamp: event.created_at,
    profile: profile as ProfileContent,
  };
}
