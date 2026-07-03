import { beforeEach, describe, expect, it } from "vitest";
import { buildTimeline, timelineStore, type TimelineScope } from "./timeline.svelte";
import { ALICE, BOB, rawEvent } from "@/test/fixtures";

function scope(overrides: Partial<TimelineScope> = {}): TimelineScope {
  return {
    channelStates: {},
    activeRelayId: null,
    searchQuery: "",
    pinnedChannels: [],
    myPubkey: null,
    ...overrides,
  };
}

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

describe("buildTimeline", () => {
  it("shows replies with parent context and counts them on the parent", () => {
    const root = rawEvent({ created_at: 100 });
    timelineStore.ingestEvent(root, RELAY_A);
    const reply = rawEvent({
      tags: [["t", "general"], ["e", root.id, "", "parent"]],
      created_at: 150,
    });
    timelineStore.ingestEvent(reply, RELAY_A);

    const items = buildTimeline(timelineStore.postsById, scope());
    const replyItem = items.find((item) => item.type === "post" && item.post.id === reply.id);
    const rootItem = items.find((item) => item.type === "post" && item.post.id === root.id);
    if (replyItem?.type !== "post" || rootItem?.type !== "post") throw new Error("missing items");
    expect(replyItem.parent?.id).toBe(root.id);
    expect(rootItem.replyCount).toBe(1);
    expect(items[0]).toBe(replyItem); // newest first
  });

  it("renders task state updates as their own timeline items", () => {
    const task = rawEvent({ kind: 1621, created_at: 100 });
    timelineStore.ingestEvent(task, RELAY_A);
    timelineStore.ingestEvent(
      rawEvent({ kind: 1630, content: "Review", tags: [["e", task.id]], created_at: 200 }),
      RELAY_A
    );
    const items = buildTimeline(timelineStore.postsById, scope());
    expect(items.map((item) => item.type)).toEqual(["state", "post"]);
  });

  it("scopes to the active relay", () => {
    const onA = rawEvent();
    const onB = rawEvent();
    timelineStore.ingestEvent(onA, RELAY_A);
    timelineStore.ingestEvent(onB, RELAY_B);
    const items = buildTimeline(timelineStore.postsById, scope({ activeRelayId: "two-example" }));
    expect(items.map((item) => item.post.id)).toEqual([onB.id]);
  });

  it("defaults to pinned channels plus mentions when nothing is included", () => {
    const pinned = rawEvent({ content: "in #design", tags: [["t", "design"]] });
    const mention = rawEvent({ content: "hey", tags: [["t", "random"], ["p", BOB]] });
    const other = rawEvent({ content: "noise", tags: [["t", "random"]] });
    for (const event of [pinned, mention, other]) timelineStore.ingestEvent(event, RELAY_A);

    const items = buildTimeline(
      timelineStore.postsById,
      scope({ pinnedChannels: ["design"], myPubkey: BOB })
    );
    expect(items.map((item) => item.post.id).sort()).toEqual([pinned.id, mention.id].sort());

    // An explicit include overrides the pinned default scope.
    const included = buildTimeline(
      timelineStore.postsById,
      scope({ pinnedChannels: ["design"], myPubkey: BOB, channelStates: { random: "included" } })
    );
    expect(included.map((item) => item.post.id).sort()).toEqual([mention.id, other.id].sort());
  });

  it("filters by search query, case-insensitively", () => {
    const hit = rawEvent({ content: "Deploy nocal #dev", tags: [] });
    const miss = rawEvent({ content: "lunch plans #dev", tags: [] });
    timelineStore.ingestEvent(hit, RELAY_A);
    timelineStore.ingestEvent(miss, RELAY_A);
    const items = buildTimeline(timelineStore.postsById, scope({ searchQuery: "deploy" }));
    expect(items.map((item) => item.post.id)).toEqual([hit.id]);
  });
});
