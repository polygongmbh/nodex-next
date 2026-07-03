import { NOSTR_KINDS } from "./nostr-kinds";

export type TaskStatus = "open" | "active" | "done" | "closed";

export interface TaskStateUpdate {
  id: string;
  kind: number;
  content: string;
  pubkey: string;
  timestamp: number; // unix seconds
}

export interface Post {
  id: string;
  pubkey: string;
  kind: number;
  content: string;
  channels: string[];
  /** Relay ids (relayUrlToId) that delivered this event — per-relay attribution. */
  relays: string[];
  timestamp: number; // unix seconds
  parentId?: string;
  mentions: string[];
  /** State events (kinds 1630–1633) folded in, sorted newest-first. */
  stateUpdates: TaskStateUpdate[];
}

export function statusFromKind(kind: number, content: string): TaskStatus | null {
  switch (kind) {
    case NOSTR_KINDS.stateDone:
      return "done";
    case NOSTR_KINDS.stateClosed:
      return "closed";
    case NOSTR_KINDS.stateOpen:
    case NOSTR_KINDS.stateReopen:
      return content.trim() ? "active" : "open";
    default:
      return null;
  }
}

/** Current status of a task post; messages (kind 1) have no status. */
export function postStatus(post: Post): TaskStatus | null {
  if (post.kind !== NOSTR_KINDS.task) return null;
  const latest = post.stateUpdates[0];
  if (latest) {
    return statusFromKind(latest.kind, latest.content) ?? "open";
  }
  return "open";
}

/** Fold a state update into a post, keeping stateUpdates sorted newest-first. */
export function foldStateUpdate(post: Post, update: TaskStateUpdate): Post {
  if (post.stateUpdates.some((existing) => existing.id === update.id)) return post;
  const stateUpdates = [...post.stateUpdates, update].sort(
    (a, b) => b.timestamp - a.timestamp
  );
  return { ...post, stateUpdates };
}

export function isTopLevel(post: Post): boolean {
  return !post.parentId;
}

/**
 * Custom label of a state update (e.g. "Review"), or null when the generic
 * status name should be shown — the UI translates that one (status.* keys).
 */
export function stateUpdateCustomLabel(update: TaskStateUpdate): string | null {
  const custom = update.content.trim();
  return custom || null;
}
