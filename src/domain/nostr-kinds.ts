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

export const TIMELINE_SUBSCRIPTION_KINDS = [
  NOSTR_KINDS.metadata,
  NOSTR_KINDS.message,
  NOSTR_KINDS.deletion,
  NOSTR_KINDS.task,
  ...TASK_STATE_KINDS,
];

export function isTaskStateKind(kind: number): boolean {
  return kind >= 1630 && kind <= 1633;
}

export function isPostKind(kind: number): boolean {
  return kind === NOSTR_KINDS.message || kind === NOSTR_KINDS.task;
}
