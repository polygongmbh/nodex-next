import { beforeEach, describe, expect, it } from "vitest";
import { timelineStore, visibleTimeline } from "./timeline.svelte";
import { ALICE, BOB, rawEvent } from "@/test/fixtures";

const RELAY_A = "wss://one.example/";
const RELAY_B = "wss://two.example/";

beforeEach(() => {
  timelineStore.reset();
  timelineStore.initRelays([RELAY_A, RELAY_B]);
});

describe("ingestEvent", () => {
  it("unions relay attribution when the same event arrives from another relay", () => {
    const event = rawEvent();
    timelineStore.ingestEvent(event, RELAY_A);
    timelineStore.ingestEvent(event, RELAY_B);
    expect(timelineStore.postsById[event.id].relays.sort()).toEqual([
      "one-example",
      "two-example",
    ]);
  });

  it("drops events without relay attribution", () => {
    const event = rawEvent();
    timelineStore.ingestEvent(event, undefined);
    expect(timelineStore.postsById[event.id]).toBeUndefined();
  });

  it("keeps folded state when a duplicate post re-ingests", () => {
    const task = rawEvent({ kind: 1621 });
    timelineStore.ingestEvent(task, RELAY_A);
    timelineStore.ingestEvent(
      rawEvent({ kind: 1631, content: "", tags: [["e", task.id]] }),
      RELAY_A
    );
    timelineStore.ingestEvent(task, RELAY_B);
    expect(timelineStore.postsById[task.id].stateUpdates).toHaveLength(1);
    expect(timelineStore.postsById[task.id].relays).toHaveLength(2);
  });

  it("replays state updates that arrived before their task", () => {
    const task = rawEvent({ kind: 1621 });
    timelineStore.ingestEvent(
      rawEvent({ kind: 1631, content: "", tags: [["e", task.id]] }),
      RELAY_A
    );
    timelineStore.ingestEvent(task, RELAY_A);
    expect(timelineStore.postsById[task.id].stateUpdates).toHaveLength(1);
  });

  it("honors deletions only from the post's own author", () => {
    const alicePost = rawEvent({ pubkey: ALICE });
    timelineStore.ingestEvent(alicePost, RELAY_A);
    timelineStore.ingestEvent(
      rawEvent({ kind: 5, pubkey: BOB, tags: [["e", alicePost.id]] }),
      RELAY_A
    );
    expect(timelineStore.postsById[alicePost.id]).toBeDefined();
    timelineStore.ingestEvent(
      rawEvent({ kind: 5, pubkey: ALICE, tags: [["e", alicePost.id]] }),
      RELAY_A
    );
    expect(timelineStore.postsById[alicePost.id]).toBeUndefined();
    // Tombstone: the deleted post cannot come back on re-ingest.
    timelineStore.ingestEvent(alicePost, RELAY_B);
    expect(timelineStore.postsById[alicePost.id]).toBeUndefined();
  });

  it("keeps the newest kind-0 profile", () => {
    timelineStore.ingestEvent(
      rawEvent({ kind: 0, content: JSON.stringify({ name: "old" }), created_at: 100 }),
      RELAY_A
    );
    timelineStore.ingestEvent(
      rawEvent({ kind: 0, content: JSON.stringify({ name: "new" }), created_at: 200 }),
      RELAY_A
    );
    timelineStore.ingestEvent(
      rawEvent({ kind: 0, content: JSON.stringify({ name: "stale" }), created_at: 150 }),
      RELAY_A
    );
    expect(timelineStore.peopleByPubkey[ALICE].name).toBe("new");
  });
});

describe("visibleTimeline", () => {
  it("shows only top-level posts with reply counts, newest first", () => {
    const root = rawEvent({ created_at: 100 });
    timelineStore.ingestEvent(root, RELAY_A);
    timelineStore.ingestEvent(
      rawEvent({ tags: [["t", "general"], ["e", root.id, "", "parent"]], created_at: 150 }),
      RELAY_A
    );
    const newer = rawEvent({ created_at: 200 });
    timelineStore.ingestEvent(newer, RELAY_A);

    const entries = visibleTimeline(timelineStore.postsById, {}, null);
    expect(entries.map((entry) => entry.post.id)).toEqual([newer.id, root.id]);
    expect(entries[1].replyCount).toBe(1);
  });

  it("scopes to the active relay", () => {
    const onA = rawEvent();
    const onB = rawEvent();
    timelineStore.ingestEvent(onA, RELAY_A);
    timelineStore.ingestEvent(onB, RELAY_B);
    const entries = visibleTimeline(timelineStore.postsById, {}, "two-example");
    expect(entries.map((entry) => entry.post.id)).toEqual([onB.id]);
  });
});
