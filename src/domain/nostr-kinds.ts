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
} as const;

export const TASK_STATE_KINDS = [1630, 1631, 1632, 1633] as const;

// Separate filters per concern: with a single mixed-kind filter, relays count
// profile/state/deletion events against the same `limit`, starving message
// backfill. Split limits keep the timeline deep.
export const TIMELINE_SUBSCRIPTION_FILTERS = [
  { kinds: [NOSTR_KINDS.message, NOSTR_KINDS.task] as number[], limit: 1000 },
  { kinds: [NOSTR_KINDS.deletion, ...TASK_STATE_KINDS] as number[], limit: 1000 },
  { kinds: [NOSTR_KINDS.metadata] as number[], limit: 500 },
];

export function isTaskStateKind(kind: number): boolean {
  return kind >= 1630 && kind <= 1633;
}

export function isPostKind(kind: number): boolean {
  return kind === NOSTR_KINDS.message || kind === NOSTR_KINDS.task;
}
