import { beforeEach, describe, expect, it } from "vitest";
import { buildTimeline, timelineStore, type TimelineItem, type TimelineScope } from "./timeline.svelte";
import { ALICE, BOB, rawEvent } from "@/test/fixtures";

const postIds = (items: TimelineItem[]): string[] =>
  items.flatMap((item) => (item.type === "post" ? [item.post.id] : []));

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

    const items = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope());
    const replyItem = items.find((item) => item.type === "post" && item.post.id === reply.id);
    const rootItem = items.find((item) => item.type === "post" && item.post.id === root.id);
    if (replyItem?.type !== "post" || rootItem?.type !== "post") throw new Error("missing items");
    expect(replyItem.parent?.id).toBe(root.id);
    expect(rootItem.replyCount).toBe(1);
    expect(items[items.length - 1]).toBe(replyItem); // newest at the bottom
  });

  it("renders task state updates as their own timeline items", () => {
    const task = rawEvent({ kind: 1621, created_at: 100 });
    timelineStore.ingestEvent(task, RELAY_A);
    timelineStore.ingestEvent(
      rawEvent({ kind: 1630, content: "Review", tags: [["e", task.id]], created_at: 200 }),
      RELAY_A
    );
    const items = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope());
    expect(items.map((item) => item.type)).toEqual(["post", "state"]);
  });

  it("scopes to the active relay", () => {
    const onA = rawEvent();
    const onB = rawEvent();
    timelineStore.ingestEvent(onA, RELAY_A);
    timelineStore.ingestEvent(onB, RELAY_B);
    const items = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope({ activeRelayId: "two-example" }));
    expect(postIds(items)).toEqual([onB.id]);
  });

  it("defaults to pinned channels plus mentions when nothing is included", () => {
    const pinned = rawEvent({ content: "in #design", tags: [["t", "design"]] });
    const mention = rawEvent({ content: "hey", tags: [["t", "random"], ["p", BOB]] });
    const other = rawEvent({ content: "noise", tags: [["t", "random"]] });
    for (const event of [pinned, mention, other]) timelineStore.ingestEvent(event, RELAY_A);

    const items = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ pinnedChannels: ["design"], myPubkey: BOB })
    );
    expect(postIds(items).sort()).toEqual([pinned.id, mention.id].sort());

    // An explicit include overrides the pinned default scope.
    const included = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ pinnedChannels: ["design"], myPubkey: BOB, channelStates: { random: "included" } })
    );
    expect(postIds(included).sort()).toEqual([mention.id, other.id].sort());
  });

  it("root focus shows the whole conversation and ignores channel scope", () => {
    const root = rawEvent({ tags: [["t", "dev"]], created_at: 100 });
    const reply = rawEvent({
      tags: [["t", "other"], ["e", root.id, "", "parent"]],
      created_at: 150,
    });
    const nested = rawEvent({
      tags: [["t", "third"], ["e", reply.id, "", "parent"]],
      created_at: 200,
    });
    const unrelated = rawEvent({ tags: [["t", "dev"]], created_at: 300 });
    for (const event of [root, reply, nested, unrelated]) {
      timelineStore.ingestEvent(event, RELAY_A);
    }
    const items = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ focusedPostId: root.id, pinnedChannels: ["dev"] })
    );
    expect(postIds(items).sort()).toEqual([root.id, reply.id, nested.id].sort());
  });

  it("nested focus scopes to the focused subtree plus ancestors, not siblings", () => {
    const root = rawEvent({ tags: [["t", "dev"]], created_at: 100 });
    const branch = rawEvent({
      tags: [["t", "other"], ["e", root.id, "", "parent"]],
      created_at: 150,
    });
    const branchChild = rawEvent({
      tags: [["t", "third"], ["e", branch.id, "", "parent"]],
      created_at: 200,
    });
    const sibling = rawEvent({
      tags: [["t", "other"], ["e", root.id, "", "parent"]],
      created_at: 250,
    });
    for (const event of [root, branch, branchChild, sibling]) {
      timelineStore.ingestEvent(event, RELAY_A);
    }
    const items = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ focusedPostId: branch.id })
    );
    // root (ancestor) + branch (focused) + branchChild (descendant); the sibling
    // branch under root is excluded.
    expect(postIds(items).sort()).toEqual([root.id, branch.id, branchChild.id].sort());
  });

  it("filters by search query, case-insensitively", () => {
    const hit = rawEvent({ content: "Deploy nocal #dev", tags: [] });
    const miss = rawEvent({ content: "lunch plans #dev", tags: [] });
    timelineStore.ingestEvent(hit, RELAY_A);
    timelineStore.ingestEvent(miss, RELAY_A);
    const items = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope({ searchQuery: "deploy" }));
    expect(postIds(items)).toEqual([hit.id]);
  });

  it("falls back to the unsearched feed when the search matches nothing", () => {
    const a = rawEvent({ content: "deploy plan", tags: [] });
    const b = rawEvent({ content: "lunch plans", tags: [] });
    timelineStore.ingestEvent(a, RELAY_A);
    timelineStore.ingestEvent(b, RELAY_A);
    const items = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ searchQuery: "no-such-text-anywhere" })
    );
    expect(postIds(items).sort()).toEqual([a.id, b.id].sort());
  });

  it("keeps an empty feed when relay scope (not search) excludes everything", () => {
    const a = rawEvent({ content: "hello", tags: [] });
    timelineStore.ingestEvent(a, RELAY_A);
    const items = buildTimeline(
      timelineStore.postsById,
      timelineStore.calendarEventsByAddress,
      scope({ activeRelayId: "two-example", searchQuery: "zzz" })
    );
    expect(items).toEqual([]);
  });

  it("includes calendar events, scoped and searched like posts", () => {
    const event = rawEvent({
      kind: 31922,
      content: "kickoff",
      tags: [["d", "e1"], ["title", "Launch"], ["start", "2026-07-10"], ["t", "dev"]],
      created_at: 500,
    });
    timelineStore.ingestEvent(event, RELAY_A);

    const shown = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope());
    const calItem = shown.find((item) => item.type === "calendarEvent");
    expect(calItem?.type === "calendarEvent" && calItem.event.title).toBe("Launch");

    // Matches its title/channel via search and relay scope; hidden otherwise.
    expect(
      buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope({ searchQuery: "launch" }))
        .some((item) => item.type === "calendarEvent")
    ).toBe(true);
    expect(
      buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, scope({ activeRelayId: "two-example" }))
        .some((item) => item.type === "calendarEvent")
    ).toBe(false);
  });
});
