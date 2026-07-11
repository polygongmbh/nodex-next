import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NdkService, NdkServiceHandlers } from "@/infrastructure/nostr/ndk-service";
import { startNdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { timelineController } from "./timeline-controller.svelte";
import { timelineStore } from "./timeline.svelte";
import { filterStore } from "./filters.svelte";
import { ALICE, BOB, rawEvent } from "@/test/fixtures";

// The real NDK service opens relay sockets; stub it so tests drive the ingest
// handlers directly and spy on the one-shot profile fetch.
vi.mock("@/infrastructure/nostr/ndk-service", () => ({
  startNdkService: vi.fn(),
}));

const RELAY_A = "wss://one.example/";
const RELAY_B = "wss://two.example/";

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
    expect(timelineController.replyParent?.id).toBe(parent.id);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "two-example" });
  });

  it("makes a reply-less post repliable: the post-menu Reply focuses its thread", () => {
    // A top-level post with no existing replies — the context menu's Reply is
    // its only entry point into the composer-as-reply flow.
    const parent = rawEvent({ tags: [["t", "dev"]] });
    timelineStore.ingestEvent(parent, RELAY_A);
    filterStore.focusThread(parent.id); // what PostMenu's Reply does
    timelineController.draft = "first reply";
    expect(timelineController.replyParent?.id).toBe(parent.id);
    expect(timelineController.sendTarget).toEqual({ type: "resolved", relayId: "one-example" });
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
