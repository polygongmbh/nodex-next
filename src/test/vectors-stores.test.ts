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
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "@/domain/publish-rules";

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
      expect(timelineStore.peopleByPubkey[pubkey]).toMatchObject(want);
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
    const parent = vector.parent ? (vector.parent as unknown as Post) : undefined;
    if ("error" in vector.expected) {
      expect(() => buildMessageTags(vector.channels, parent)).toThrowError(
        new PublishRuleError(vector.expected.error!)
      );
    } else {
      expect(buildMessageTags(vector.channels, parent)).toEqual(vector.expected.tags);
    }
  });

  it.each(publishVectors.resolveDraftChannels)("$name", ({ content, included, expected }) => {
    expect(resolveDraftChannels(content, included).sort()).toEqual([...expected].sort());
  });
});
