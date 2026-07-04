// NIP-52 calendar events: kind 31922 (date-based, start/end = YYYY-MM-DD)
// and 31923 (time-based, start/end = unix seconds). Addressable per author —
// unlike topics, the namespace is (pubkey, d), NOT relay-communal. Central to
// the "posting events → direct calendar sync" promise of Nodex Talk.

import { NOSTR_KINDS } from "./nostr-kinds";
import { deriveChannelTags } from "./hashtags";
import type { RawNostrEvent } from "./event-to-post";

export interface CalendarEvent {
  d: string;
  pubkey: string;
  eventId: string;
  kind: number;
  title: string;
  /** As tagged: YYYY-MM-DD for kind 31922, unix seconds for kind 31923. */
  start: string;
  end?: string;
  location?: string;
  content: string;
  channels: string[];
  relays: string[];
  createdAt: number;
}

export function isCalendarKind(kind: number): boolean {
  return kind === NOSTR_KINDS.calendarDate || kind === NOSTR_KINDS.calendarTime;
}

/** Replaceable address key: calendar events are per-author, per-d. */
export function calendarAddress(event: Pick<CalendarEvent, "pubkey" | "d">): string {
  return `${event.pubkey}:${event.d}`;
}

export function parseCalendarEvent(
  event: RawNostrEvent,
  relayIds: string[]
): CalendarEvent | null {
  const tag = (name: string) => event.tags.find((entry) => entry[0] === name && entry[1])?.[1];
  const d = tag("d");
  const start = tag("start");
  if (!d || !start) return null;
  const title = tag("title")?.trim() || event.content.split("\n")[0].trim();
  if (!title) return null;
  return {
    d,
    pubkey: event.pubkey,
    eventId: event.id,
    kind: event.kind,
    title,
    start,
    end: tag("end"),
    location: tag("location"),
    content: event.content,
    channels: deriveChannelTags(event.tags, event.content),
    relays: [...relayIds],
    createdAt: event.created_at,
  };
}
