import type { RawNostrEvent } from "@/domain/event-to-post";
import type { Post } from "@/domain/post";

export const ALICE = "a".repeat(63) + "1";
export const BOB = "b".repeat(63) + "2";

let eventCounter = 0;

export function eventId(): string {
  eventCounter += 1;
  return eventCounter.toString(16).padStart(64, "e");
}

export function rawEvent(overrides: Partial<RawNostrEvent> = {}): RawNostrEvent {
  return {
    id: eventId(),
    pubkey: ALICE,
    kind: 1,
    content: "hello #general",
    tags: [["t", "general"]],
    created_at: 1_750_000_000,
    ...overrides,
  };
}

export function post(overrides: Partial<Post> = {}): Post {
  return {
    id: eventId(),
    pubkey: ALICE,
    kind: 1,
    content: "hello #general",
    channels: ["general"],
    relays: ["relay-one-example"],
    timestamp: 1_750_000_000,
    mentions: [],
    stateUpdates: [],
    ...overrides,
  };
}
