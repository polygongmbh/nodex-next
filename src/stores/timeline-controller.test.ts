import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NdkService, NdkServiceHandlers } from "@/infrastructure/nostr/ndk-service";
import { startNdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { timelineController } from "./timeline-controller.svelte";
import { timelineStore } from "./timeline.svelte";
import { filterStore } from "./filters.svelte";
import { ALICE, BOB, post as makePost, rawEvent } from "@/test/fixtures";

// The real NDK service opens relay sockets; stub it so tests drive the ingest
// handlers directly and spy on the one-shot profile fetch.
vi.mock("@/infrastructure/nostr/ndk-service", () => ({
  startNdkService: vi.fn(),
}));

const RELAY_A = "wss://one.example/";
const RELAY_B = "wss://two.example/";

// replyParent is a Post | CalendarEvent union; both carry an event id under a
// different key.
function replyParentId(): string | undefined {
  const rp = timelineController.replyParent;
  if (!rp) return undefined;
  return "eventId" in rp ? rp.eventId : rp.id;
}

// A NIP-52 date-based calendar event (kind 31922) with a #team channel.
function calendarRaw(overrides: Record<string, unknown> = {}) {
  return rawEvent({
    kind: 31922,
    pubkey: ALICE,
    content: "offsite details",
    tags: [["d", "offsite"], ["title", "Offsite"], ["start", "2026-08-01"], ["t", "team"]],
    ...overrides,
  });
}

beforeEach(() => {
  timelineStore.reset();
  filterStore.reset();
  timelineController.draft = "";
  timelineController.clearCalendarDraft();
  timelineStore.initRelays([RELAY_A, RELAY_B]);
  timelineStore.setRelayConnected(RELAY_A, true);
  timelineStore.setRelayConnected(RELAY_B, true);
});

// The composer's context-aware send: it only forces a space pick when the
// draft's channels genuinely span more than one space.
describe("sendTarget", () => {
  it("has no target until the draft carries a channel", () => {
    timelineController.draft = "just typing";
    expect(timelineController.sendTarget.type).toBe("noChannel");
  });

  it("auto-resolves to the sole space carrying the channel (no prompt)", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineController.draft = "hello #dev";
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "one-example" });
  });

  it("is ambiguous when the channel exists on multiple spaces", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_B);
    timelineController.draft = "hello #dev";
    const target = timelineController.sendTarget;
    expect(target.type).toBe("ambiguous");
    if (target.type === "ambiguous") {
      expect(target.candidates.map((relay) => relay.id).sort()).toEqual([
        "one-example",
        "two-example",
      ]);
    }
  });

  it("honors an actively selected space over channel membership", () => {
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_A);
    timelineStore.ingestEvent(rawEvent({ tags: [["t", "dev"]] }), RELAY_B);
    filterStore.selectSpace("two-example");
    timelineController.draft = "hello #dev";
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "two-example" });
  });
});

describe("reply composition in a focused thread", () => {
  it("pins the send to the parent's origin relay, overriding the active space", () => {
    const parent = rawEvent({ tags: [["t", "dev"]] });
    timelineStore.ingestEvent(parent, RELAY_B); // parent delivered by two-example
    filterStore.selectSpace("one-example"); // active space is elsewhere
    filterStore.focusThread(parent.id);
    timelineController.draft = "on it";
    expect(replyParentId()).toBe(parent.id);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "two-example" });
  });

  it("makes a reply-less post repliable: the post-menu Reply focuses its thread", () => {
    // A top-level post with no existing replies — the context menu's Reply is
    // its only entry point into the composer-as-reply flow.
    const parent = rawEvent({ tags: [["t", "dev"]] });
    timelineStore.ingestEvent(parent, RELAY_A);
    filterStore.focusThread(parent.id); // what PostMenu's Reply does
    timelineController.draft = "first reply";
    expect(replyParentId()).toBe(parent.id);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "one-example" });
  });

  it("a focus on an unknown id has no reply parent (composer stays plain)", () => {
    // A deep link can focus an id before its event arrives; the bar must not
    // treat it as a reply target — it becomes an ordinary composer.
    filterStore.focusThread("f".repeat(64));
    expect(timelineController.replyParent).toBeUndefined();
    expect(replyParentId()).toBeUndefined();
  });

  it("inherits the parent's channels so a reply needs no typed hashtag", () => {
    const parent = rawEvent({ content: "parent post", tags: [["t", "dev"], ["t", "ops"]] });
    timelineStore.ingestEvent(parent, RELAY_A);
    filterStore.focusThread(parent.id);
    timelineController.draft = "no hashtags here";
    expect(timelineController.draftChannels.sort()).toEqual(["dev", "ops"]);
  });
});

// Reactions publish to the relays that delivered the post (per-relay
// attribution), normalize the thumbs to +/-, and toggle off by deleting the
// prior kind-7 when the same emoji is tapped again.
describe("react", () => {
  let publish: ReturnType<typeof vi.fn>;
  let post: import("@/domain/post").Post;

  const session: StoredSession = {
    pubkeyHex: ALICE,
    privateKeyHex: "b".repeat(64),
    username: "alice",
    apiBaseUrl: "https://noas.example",
    relayUrls: [RELAY_A, RELAY_B],
  };

  beforeEach(() => {
    timelineController.stop();
    publish = vi.fn().mockResolvedValue(undefined);
    const service: NdkService = {
      publish: publish as NdkService["publish"],
      fetchProfileEvent: vi.fn().mockResolvedValue(null),
      fetchProfileEvents: vi.fn().mockResolvedValue([]),
      stop: vi.fn(),
    };
    vi.mocked(startNdkService).mockReturnValue(service);
    timelineController.start(session);
    timelineStore.setRelayConnected(RELAY_A, true);
    timelineStore.setRelayConnected(RELAY_B, true);
    // A post by someone else, delivered only by one-example.
    const raw = rawEvent({ pubkey: BOB, tags: [["t", "dev"]] });
    timelineStore.ingestEvent(raw, RELAY_A);
    post = timelineStore.postsById[raw.id];
  });

  it("publishes a kind-7 reaction to the post's delivery relays", async () => {
    await timelineController.react(post, "❤️");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 7,
        content: "❤️",
        relayUrls: [RELAY_A],
        tags: expect.arrayContaining([["e", post.id, RELAY_A, BOB], ["k", "1"]]),
      })
    );
  });

  it("normalizes the thumbs to + / - on the wire", async () => {
    await timelineController.react(post, "👍");
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 7, content: "+" }));
    await timelineController.react(post, "👎");
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 7, content: "-" }));
  });

  it("re-reacting with the same emoji deletes the prior reaction (kind 5)", async () => {
    const mine = rawEvent({
      kind: 7,
      pubkey: ALICE,
      content: "❤️",
      tags: [["e", post.id, "", BOB], ["p", BOB], ["k", "1"]],
    });
    timelineStore.ingestEvent(mine, RELAY_A);
    await timelineController.react(post, "❤️");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 5,
        content: "",
        relayUrls: [RELAY_A],
        tags: [["e", mine.id], ["k", "7"]],
      })
    );
  });

  it("reacting with a different emoji publishes a new kind-7", async () => {
    const mine = rawEvent({
      kind: 7,
      pubkey: ALICE,
      content: "❤️",
      tags: [["e", post.id, "", BOB], ["p", BOB], ["k", "1"]],
    });
    timelineStore.ingestEvent(mine, RELAY_A);
    await timelineController.react(post, "🎉");
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 7, content: "🎉" })
    );
  });

  it("throws when no connected relay delivered the post", async () => {
    timelineStore.setRelayConnected(RELAY_A, false);
    await expect(timelineController.react(post, "❤️")).rejects.toThrow("error.postSpaceUnavailable");
  });
});

const SESSION: StoredSession = {
  pubkeyHex: ALICE,
  privateKeyHex: "b".repeat(64),
  username: "alice",
  apiBaseUrl: "https://noas.example",
  relayUrls: [RELAY_A, RELAY_B],
};

// Boot the controller against a publish-spy service and reconnect both relays
// (start() re-inits them disconnected).
function startWithPublishSpy(): ReturnType<typeof vi.fn> {
  timelineController.stop();
  const publish = vi.fn().mockResolvedValue(undefined);
  const service: NdkService = {
    publish: publish as NdkService["publish"],
    fetchProfileEvent: vi.fn().mockResolvedValue(null),
    fetchProfileEvents: vi.fn().mockResolvedValue([]),
    stop: vi.fn(),
  };
  vi.mocked(startNdkService).mockReturnValue(service);
  timelineController.start(SESSION);
  timelineStore.setRelayConnected(RELAY_A, true);
  timelineStore.setRelayConnected(RELAY_B, true);
  return publish;
}

describe("deletePost", () => {
  let publish: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    publish = startWithPublishSpy();
  });

  it("tombstones an own post with e+k tags on its delivery relays", async () => {
    const mine = makePost({ pubkey: ALICE, kind: 1, relays: ["one-example"] });
    timelineStore.postsById[mine.id] = mine;
    await timelineController.deletePost(mine);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 5,
        content: "",
        relayUrls: [RELAY_A],
        tags: [["e", mine.id], ["k", "1"]],
      })
    );
  });

  it("refuses to delete another author's post", async () => {
    const theirs = makePost({ pubkey: BOB, relays: ["one-example"] });
    await expect(timelineController.deletePost(theirs)).rejects.toThrow("error.notConnected");
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("recompose", () => {
  let publish: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    publish = startWithPublishSpy();
  });

  it("publishes the replacement, then deletes the original, then clears state", async () => {
    const original = makePost({
      pubkey: ALICE,
      kind: 1,
      content: "old text #dev",
      channels: ["dev"],
      relays: ["one-example"],
    });
    timelineStore.postsById[original.id] = original;
    timelineController.recompose(original);
    expect(timelineController.draft).toBe("old text #dev");
    timelineController.draft = "new text";
    await timelineController.sendMessage();

    expect(publish).toHaveBeenCalledTimes(2);
    const [replacement, deletion] = publish.mock.calls.map((call) => call[0]);
    expect(replacement).toMatchObject({ kind: 1, content: "new text", relayUrls: [RELAY_A] });
    expect(replacement.tags).toContainEqual(["t", "dev"]);
    expect(deletion).toMatchObject({
      kind: 5,
      content: "",
      relayUrls: [RELAY_A],
      tags: [["e", original.id], ["k", "1"]],
    });
    expect(timelineController.recomposeOf).toBeNull();
    expect(timelineController.draft).toBe("");
  });

  it("inherits the original's channels and pins to its origin relay", async () => {
    const original = makePost({
      pubkey: ALICE,
      content: "original body", // no typed hashtags
      channels: ["dev", "ops"],
      relays: ["two-example"], // delivered by two-example
    });
    timelineStore.postsById[original.id] = original;
    filterStore.selectSpace("one-example"); // active space is elsewhere
    timelineController.recompose(original);
    expect(timelineController.draftChannels.sort()).toEqual(["dev", "ops"]);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "two-example" });
    timelineController.draft = "replacement";
    await timelineController.sendMessage();
    expect(publish.mock.calls[0][0]).toMatchObject({ relayUrls: [RELAY_B] });
  });

  it("threads the replacement under the original's parent when present", async () => {
    const parent = makePost({ pubkey: BOB, relays: ["one-example"] });
    timelineStore.postsById[parent.id] = parent;
    const original = makePost({
      pubkey: ALICE,
      channels: ["dev"],
      relays: ["one-example"],
      parentId: parent.id,
    });
    timelineStore.postsById[original.id] = original;
    timelineController.recompose(original);
    timelineController.draft = "reworded reply";
    await timelineController.sendMessage();
    expect(publish.mock.calls[0][0].tags).toContainEqual(["e", parent.id, RELAY_A, "root", BOB]);
  });

  it("drops threading tags when the original's parent is gone", async () => {
    const original = makePost({
      pubkey: ALICE,
      channels: ["dev"],
      relays: ["one-example"],
      parentId: "f".repeat(64), // parent not in the store
    });
    timelineStore.postsById[original.id] = original;
    timelineController.recompose(original);
    timelineController.draft = "reworded";
    await timelineController.sendMessage();
    const tags: string[][] = publish.mock.calls[0][0].tags;
    expect(tags.some((tag) => tag[0] === "e")).toBe(false);
  });

  it("cancelRecompose clears the marker and the prefilled draft", () => {
    const original = makePost({ pubkey: ALICE, relays: ["one-example"] });
    timelineController.recompose(original);
    timelineController.cancelRecompose();
    expect(timelineController.recomposeOf).toBeNull();
    expect(timelineController.draft).toBe("");
  });
});

// Calendar events (NIP-52) are first-class menu/reply targets: replies are
// NIP-22 kind-1111 comments rooted at the event's addressable coordinate,
// reactions carry the event kind, and an own event deletes by e+k+a.
describe("calendar events as reply/menu targets", () => {
  const address = `${ALICE}:offsite`;
  let publish: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    publish = startWithPublishSpy();
    timelineStore.ingestEvent(calendarRaw(), RELAY_A); // delivered by one-example
  });

  it("focusing a calendar event makes it the reply parent", () => {
    const cal = timelineStore.calendarEventsByAddress[address];
    filterStore.focusThread(cal.eventId);
    expect(replyParentId()).toBe(cal.eventId);
    // Channels are inherited from the event, so no typed hashtag is needed.
    timelineController.draft = "count me in";
    expect(timelineController.draftChannels).toEqual(["team"]);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "one-example" });
  });

  it("replies to a calendar event as a NIP-22 kind-1111 comment (A/a+e, pinned)", async () => {
    const cal = timelineStore.calendarEventsByAddress[address];
    filterStore.focusThread(cal.eventId);
    timelineController.draft = "count me in";
    await timelineController.sendMessage();

    const published = publish.mock.calls[0][0];
    expect(published.kind).toBe(1111);
    expect(published.relayUrls).toEqual([RELAY_A]);
    expect(published.tags).toContainEqual(["t", "team"]);
    expect(published.tags).toContainEqual(["A", `31922:${address}`, RELAY_A]);
    expect(published.tags).toContainEqual(["K", "31922"]);
    expect(published.tags).toContainEqual(["a", `31922:${address}`, RELAY_A]);
    expect(published.tags).toContainEqual(["e", cal.eventId, RELAY_A, ALICE]);
    expect(published.tags).toContainEqual(["k", "31922"]);
  });

  it("reacts to a calendar event with the event kind in the k-tag", async () => {
    const cal = timelineStore.calendarEventsByAddress[address];
    await timelineController.react(cal, "🎉");
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 7,
        content: "🎉",
        relayUrls: [RELAY_A],
        tags: expect.arrayContaining([["e", cal.eventId, RELAY_A, ALICE], ["k", "31922"]]),
      })
    );
  });

  it("deletes an own calendar event with e+k+a tags", async () => {
    const cal = timelineStore.calendarEventsByAddress[address];
    await timelineController.deletePost(cal);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 5,
        content: "",
        relayUrls: [RELAY_A],
        tags: [["e", cal.eventId], ["k", "31922"], ["a", `31922:${address}`]],
      })
    );
  });
});

// The profile-editor merge base is served cache-first: the live subscription
// primes it so opening the editor usually needs no fetch, and the fetch stays
// as the cold-start/miss fallback — but emptiness is never cached.
describe("own-profile cache (fetchOwnProfile)", () => {
  let handlers: NdkServiceHandlers;
  let fetchProfileEvent: ReturnType<typeof vi.fn>;

  const session: StoredSession = {
    pubkeyHex: ALICE,
    privateKeyHex: "b".repeat(64),
    username: "alice",
    apiBaseUrl: "https://noas.example",
    relayUrls: [RELAY_A, RELAY_B],
  };

  const metadataEvent = (content: Record<string, unknown>, created_at = 100) =>
    rawEvent({ kind: 0, pubkey: ALICE, content: JSON.stringify(content), created_at });

  // Feed one event through the real ingest path, then settle the batcher so it
  // flushes synchronously (the batcher buffers until EOSE during hydration).
  function ingest(event: ReturnType<typeof metadataEvent>, relayUrl: string) {
    handlers.onEvent(event, relayUrl);
    handlers.onEose();
  }

  beforeEach(() => {
    timelineController.stop();
    fetchProfileEvent = vi.fn().mockResolvedValue(null);
    const service: NdkService = {
      publish: vi.fn().mockResolvedValue(undefined),
      fetchProfileEvent: fetchProfileEvent as NdkService["fetchProfileEvent"],
      fetchProfileEvents: vi.fn().mockResolvedValue([]),
      stop: vi.fn(),
    };
    vi.mocked(startNdkService).mockImplementation((_urls, _key, h) => {
      handlers = h;
      return service;
    });
    timelineController.start(session);
  });

  it("returns an ingested own kind-0 without hitting the network", async () => {
    ingest(metadataEvent({ name: "alice", lud16: "alice@wallet.example" }), RELAY_A);
    const profile = await timelineController.fetchOwnProfile();
    expect(profile).toMatchObject({ name: "alice", lud16: "alice@wallet.example" });
    expect(fetchProfileEvent).not.toHaveBeenCalled();
  });

  it("falls back a per-space scope to the newest own kind-0 across spaces", async () => {
    ingest(metadataEvent({ name: "alice" }), RELAY_A);
    // two-example carries no own kind-0 → "*" fallback, still no fetch.
    const profile = await timelineController.fetchOwnProfile("two-example");
    expect(profile).toMatchObject({ name: "alice" });
    expect(fetchProfileEvent).not.toHaveBeenCalled();
  });

  it("never caches emptiness: an empty fetch re-fetches next time", async () => {
    expect(await timelineController.fetchOwnProfile("one-example")).toEqual({});
    expect(await timelineController.fetchOwnProfile("one-example")).toEqual({});
    expect(fetchProfileEvent).toHaveBeenCalledTimes(2);
  });

  it("caches a non-empty fetch result and short-circuits the next call", async () => {
    fetchProfileEvent.mockResolvedValue(metadataEvent({ about: "hi" }, 500));
    expect(await timelineController.fetchOwnProfile()).toMatchObject({ about: "hi" });
    expect(await timelineController.fetchOwnProfile()).toMatchObject({ about: "hi" });
    expect(fetchProfileEvent).toHaveBeenCalledTimes(1);
  });
});

// A sleep/offline gap leaves NDK with dead subscriptions or stuck relays;
// resync rebuilds the service on the same session while the stores keep the
// already-ingested timeline (re-delivered backfill dedupes in ingest).
describe("resync", () => {
  it("rebuilds the relay service on the same session, keeping the timeline", () => {
    timelineController.stop();
    vi.mocked(startNdkService).mockClear();
    const stopFirst = vi.fn();
    const makeService = (stop: () => void): NdkService => ({
      publish: vi.fn().mockResolvedValue(undefined),
      fetchProfileEvent: vi.fn().mockResolvedValue(null),
      fetchProfileEvents: vi.fn().mockResolvedValue([]),
      stop,
    });
    vi.mocked(startNdkService)
      .mockReturnValueOnce(makeService(stopFirst))
      .mockReturnValueOnce(makeService(vi.fn()));
    timelineController.start(SESSION);
    const raw = rawEvent({ tags: [["t", "dev"]] });
    timelineStore.ingestEvent(raw, RELAY_A);

    timelineController.resync();

    expect(stopFirst).toHaveBeenCalled();
    expect(startNdkService).toHaveBeenCalledTimes(2);
    const [relayUrls, privateKeyHex] = vi.mocked(startNdkService).mock.calls[1];
    expect(relayUrls).toEqual(SESSION.relayUrls);
    expect(privateKeyHex).toBe(SESSION.privateKeyHex);
    expect(timelineStore.postsById[raw.id]).toBeDefined();
  });

  it("is a no-op while no session is running", () => {
    timelineController.stop();
    vi.mocked(startNdkService).mockClear();
    timelineController.resync();
    expect(startNdkService).not.toHaveBeenCalled();
  });
});
