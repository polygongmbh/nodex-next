// Reference adapter for the cross-client spec vectors — store semantics
// (ingest scenarios) and timeline derivation (scope scenarios).

import { beforeEach, describe, expect, it } from "vitest";
import ingestVectors from "../../spec/vectors/ingest-scenarios.json";
import scopeVectors from "../../spec/vectors/timeline-scope.json";
import publishVectors from "../../spec/vectors/publish-rules.json";
import { buildTimeline, timelineStore, type TimelineScope } from "@/stores/timeline.svelte";
import { postStatus, type Post } from "@/domain/post";
import type { RawNostrEvent } from "@/domain/event-to-post";
import {
  buildDeletionTags,
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
  resolveTargetRelays,
} from "@/domain/publish-rules";
import { buildReactionTags } from "@/domain/reaction-events";

interface Step {
  event: RawNostrEvent;
  relayUrl: string | null;
}

function runSteps(relayUrls: string[], steps: Step[]) {
  timelineStore.reset();
  timelineStore.initRelays(relayUrls);
  for (const step of steps) {
    timelineStore.ingestEvent(step.event, step.relayUrl ?? undefined);
  }
}

describe("vectors: ingest scenarios", () => {
  it.each(ingestVectors.scenarios)("$name", ({ steps, expected }) => {
    runSteps(ingestVectors.relayUrls, steps as Step[]);
    for (const [id, want] of Object.entries(expected.posts ?? {})) {
      const post = timelineStore.postsById[id];
      expect(post, `post ${id}`).toBeDefined();
      if (want.relays) expect(post.relays.sort()).toEqual([...want.relays].sort());
      if ("status" in want) expect(postStatus(post)).toBe(want.status);
      if ("stateUpdates" in want) expect(post.stateUpdates).toHaveLength(want.stateUpdates!);
    }
    for (const id of expected.absentPosts ?? []) {
      expect(timelineStore.postsById[id]).toBeUndefined();
    }
    for (const [pubkey, want] of Object.entries(expected.people ?? {})) {
      // Person carries the full kind-0 content on `.profile`; the vector's
      // person fields (name, …) are asserted against that record.
      expect(timelineStore.peopleByPubkey[pubkey].profile).toMatchObject(want);
    }
    for (const [id, want] of Object.entries(expected.topics ?? {})) {
      expect(timelineStore.topicsById[id]).toMatchObject(want);
    }
    for (const id of expected.absentTopics ?? []) {
      expect(timelineStore.topicsById[id]).toBeUndefined();
    }
    for (const [address, want] of Object.entries(expected.calendar ?? {})) {
      const calendarEvent = timelineStore.calendarEventsByAddress[address];
      expect(calendarEvent, `calendar ${address}`).toBeDefined();
      const { relays, ...rest } = want as Record<string, unknown> & { relays?: string[] };
      expect(calendarEvent).toMatchObject(rest);
      if (relays) expect(calendarEvent.relays.sort()).toEqual([...relays].sort());
    }
    for (const address of expected.absentCalendar ?? []) {
      expect(timelineStore.calendarEventsByAddress[address]).toBeUndefined();
    }
    for (const [targetId, want] of Object.entries(expected.reactions ?? {})) {
      const bucket = timelineStore.reactionsByTargetId[targetId] ?? {};
      const byEmoji: Record<string, string[]> = {};
      for (const reaction of Object.values(bucket)) {
        (byEmoji[reaction.emoji] ??= []).push(reaction.pubkey);
      }
      for (const reactors of Object.values(byEmoji)) reactors.sort();
      expect(byEmoji, `reactions on ${targetId}`).toEqual(want);
    }
    for (const [targetId, want] of Object.entries(expected.reactionRelays ?? {})) {
      for (const [reactor, relays] of Object.entries(want as Record<string, string[]>)) {
        expect(
          timelineStore.reactionsByTargetId[targetId]?.[reactor]?.relays.slice().sort()
        ).toEqual([...relays].sort());
      }
    }
  });
});

describe("vectors: timeline scope", () => {
  beforeEach(() => {
    runSteps(scopeVectors.relayUrls, scopeVectors.events as Step[]);
  });

  it.each(scopeVectors.scenarios)("$name", ({ scope, expected }) => {
    const items = buildTimeline(timelineStore.postsById, timelineStore.calendarEventsByAddress, {
      channelStates: {},
      activeRelayId: null,
      searchQuery: "",
      pinnedChannels: [],
      myPubkey: null,
      focusedPostId: null,
      ...(scope as Partial<TimelineScope>),
    });
    expect(
      items.map((item) => ({
        type: item.type,
        id:
          item.type === "post"
            ? item.post.id
            : item.type === "state"
              ? item.update.id
              : item.event.eventId,
      }))
    ).toEqual(expected);
  });
});

describe("vectors: publish rules", () => {
  const allRelays = publishVectors.relays;

  it.each(publishVectors.resolvePublishRelay)("$name", (vector) => {
    const relays = vector.relaySubset
      ? allRelays.filter((relay) => vector.relaySubset!.includes(relay.id))
      : allRelays;
    const parent = vector.parent ? (vector.parent as unknown as Post) : undefined;
    const channelSpaceIds = "channelSpaceIds" in vector ? vector.channelSpaceIds : undefined;
    if ("error" in vector.expected) {
      expect(() =>
        resolvePublishRelay(relays, vector.activeRelayId, parent, channelSpaceIds)
      ).toThrowError(new PublishRuleError(vector.expected.error!));
    } else {
      expect(resolvePublishRelay(relays, vector.activeRelayId, parent, channelSpaceIds).id).toBe(
        vector.expected.relayId
      );
    }
  });

  it.each(publishVectors.buildMessageTags)("$name", (vector) => {
    const reply = vector.reply
      ? {
          parent: vector.reply.parent as unknown as Post,
          root: vector.reply.root as unknown as Post,
        }
      : undefined;
    if ("error" in vector.expected) {
      expect(() => buildMessageTags(vector.channels, reply)).toThrowError(
        new PublishRuleError(vector.expected.error!)
      );
    } else {
      expect(buildMessageTags(vector.channels, reply)).toEqual(vector.expected.tags);
    }
  });

  it.each(publishVectors.resolveDraftChannels)("$name", ({ content, included, expected }) => {
    expect(resolveDraftChannels(content, included).sort()).toEqual([...expected].sort());
  });

  it.each(publishVectors.resolveTargetRelays)("$name", (vector) => {
    if ("error" in vector.expected) {
      expect(() => resolveTargetRelays(allRelays, vector.targetRelayIds)).toThrowError(
        new PublishRuleError(vector.expected.error!)
      );
    } else {
      expect(resolveTargetRelays(allRelays, vector.targetRelayIds).map((relay) => relay.id)).toEqual(
        vector.expected.relayIds
      );
    }
  });

  it.each(publishVectors.buildReactionTags)("$name", (vector) => {
    expect(buildReactionTags(vector.target, vector.relayHint)).toEqual(vector.expected.tags);
  });

  it.each(publishVectors.buildDeletionTags)("$name", (vector) => {
    expect(buildDeletionTags(vector.targets)).toEqual(vector.expected.tags);
  });
});
