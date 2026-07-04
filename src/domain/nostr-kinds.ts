// Event kinds shared with nodex/mostr on the same relay.
export const NOSTR_KINDS = {
  metadata: 0,
  message: 1,
  deletion: 5,
  task: 1621,
  stateOpen: 1630,
  stateDone: 1631,
  stateClosed: 1632,
  stateReopen: 1633,
  /** Addressable shared topic definition — see docs/nip-topics.md. */
  topic: 30177,
  /** NIP-52 date-based calendar event (start/end = YYYY-MM-DD). */
  calendarDate: 31922,
  /** NIP-52 time-based calendar event (start/end = unix seconds). */
  calendarTime: 31923,
} as const;

export const TASK_STATE_KINDS = [1630, 1631, 1632, 1633] as const;

// Separate filters per concern: with a single mixed-kind filter, relays count
// profile/state/deletion events against the same `limit`, starving message
// backfill. Profiles get their OWN subscription, opened first, so names and
// avatars stream in without queueing behind thousands of content events.
export const PROFILE_SUBSCRIPTION_FILTERS = [
  { kinds: [NOSTR_KINDS.metadata] as number[], limit: 500 },
  { kinds: [NOSTR_KINDS.topic] as number[], limit: 200 },
];

export const CONTENT_SUBSCRIPTION_FILTERS = [
  { kinds: [NOSTR_KINDS.message, NOSTR_KINDS.task] as number[], limit: 1000 },
  { kinds: [NOSTR_KINDS.deletion, ...TASK_STATE_KINDS] as number[], limit: 1000 },
  { kinds: [NOSTR_KINDS.calendarDate, NOSTR_KINDS.calendarTime] as number[], limit: 500 },
];

export function isTaskStateKind(kind: number): boolean {
  return kind >= 1630 && kind <= 1633;
}

export function isPostKind(kind: number): boolean {
  return kind === NOSTR_KINDS.message || kind === NOSTR_KINDS.task;
}
