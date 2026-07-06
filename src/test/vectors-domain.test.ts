// Reference adapter for the cross-client spec vectors (spec/README.md) —
// domain-layer contracts. The Flutter client ports this same mapping.

import { describe, expect, it } from "vitest";
import channels from "../../spec/vectors/channels.json";
import contentTokens from "../../spec/vectors/content-tokens.json";
import relayIdentity from "../../spec/vectors/relay-identity.json";
import timestamps from "../../spec/vectors/timestamps.json";
import topicIdentity from "../../spec/vectors/topic-identity.json";
import classifyVectors from "../../spec/vectors/classify-events.json";
import pinningVectors from "../../spec/vectors/pinning.json";
import calendarVectors from "../../spec/vectors/calendar-events.json";
import { deriveChannelTags, extractHashtagsFromContent, isHexColorToken } from "@/domain/hashtags";
import { tokenizeContent } from "@/domain/content-tokens";
import { spacesToPinChannelFor } from "@/domain/channel";
import { normalizeRelayUrl, relayDisplayName, relayUrlToId } from "@/domain/relay-identity";
import { post as postFixture } from "@/test/fixtures";
import { timelineTimestampBucket } from "@/domain/timeline-timestamp";
import { buildTopicEvent, parseTopicEvent, topicIdForChannels } from "@/domain/topic-events";
import { classifyEvent, type RawNostrEvent } from "@/domain/event-to-post";
import { buildCalendarEvent } from "@/domain/calendar-events";

describe("vectors: channels", () => {
  it.each(channels.extractHashtags)("$name", ({ content, expected }) => {
    expect(extractHashtagsFromContent(content)).toEqual(expected);
  });
  it.each(channels.isHexColorToken)("$name", ({ token, expected }) => {
    expect(isHexColorToken(token)).toBe(expected);
  });
  it.each(channels.deriveChannelTags)("$name", ({ tags, content, expected }) => {
    expect(deriveChannelTags(tags as string[][], content).sort()).toEqual([...expected].sort());
  });
});

describe("vectors: content tokens", () => {
  it.each(contentTokens.tokenize)("$name", ({ content, expected }) => {
    expect(tokenizeContent(content)).toEqual(expected);
  });
});

describe("vectors: relay identity", () => {
  it.each(relayIdentity.normalize)("$name", ({ input, expected }) => {
    expect(normalizeRelayUrl(input)).toBe(expected);
  });
  it.each(relayIdentity.relayId)("$name", ({ input, expected }) => {
    expect(relayUrlToId(input)).toBe(expected);
  });
  it.each(relayIdentity.displayName)("$name", ({ input, expected }) => {
    expect(relayDisplayName(input)).toBe(expected);
  });
});

describe("vectors: timestamp buckets", () => {
  it.each(timestamps.cases)("$name", ({ now, date, expected }) => {
    expect(timelineTimestampBucket(new Date(date), new Date(now))).toBe(expected);
  });
});

describe("vectors: topic identity", () => {
  it.each(topicIdentity.topicId)("$name", ({ channels: input, expected }) => {
    expect(topicIdForChannels(input)).toBe(expected);
  });
  it.each(topicIdentity.buildTopicEvent)("$name", ({ topicName, primary, secondary, expected }) => {
    const built = buildTopicEvent(topicName, primary, secondary);
    expect(built.kind).toBe(expected.kind);
    expect(built.tags.find((tag) => tag[0] === "d")?.[1]).toBe(expected.d);
    expect(built.tags.find((tag) => tag[0] === "title")?.[1]).toBe(expected.title);
    expect(built.tags.filter((tag) => tag[0] === "t").map((tag) => tag[1])).toEqual(
      expected.tTags
    );
  });
  it.each(topicIdentity.parseTopicEvent)("$name", ({ tags, expected }) => {
    const parsed = parseTopicEvent({
      id: "ev",
      pubkey: "alice",
      kind: 30177,
      content: "",
      tags: tags as string[][],
      created_at: 100,
    });
    if (expected === null) expect(parsed).toBeNull();
    else expect(parsed).toMatchObject(expected);
  });
});

describe("vectors: per-space pinning", () => {
  it.each(pinningVectors.spacesToPinChannelFor)("$name", ({ posts, channel, scope, expected }) => {
    const built = posts.map((partial) => postFixture(partial));
    expect(spacesToPinChannelFor(built, channel, scope)).toEqual(expected);
  });
});

describe("vectors: calendar events", () => {
  it.each(calendarVectors.buildCalendarEvent)("$name", ({ input, expected }) => {
    const { d, ...rest } = input;
    const built = buildCalendarEvent(rest, d);
    expect(built.kind).toBe(expected.kind);
    expect(built.content).toBe(expected.content);
    expect(built.tags).toEqual(expected.tags);
  });
});

describe("vectors: event classification", () => {
  it.each(classifyVectors.cases)("$name", ({ event, relayIds, expected }) => {
    const classified = classifyEvent(event as RawNostrEvent, relayIds);
    expect(classified.type).toBe(expected.type);
    if (classified.type === "post") {
      const post = classified.post;
      if (expected.channels) expect(post.channels.sort()).toEqual([...expected.channels].sort());
      if (expected.relays) expect(post.relays).toEqual(expected.relays);
      if (expected.mentions) expect(post.mentions).toEqual(expected.mentions);
      if (expected.kind) expect(post.kind).toBe(expected.kind);
      if ("parentId" in expected) expect(post.parentId ?? null).toBe(expected.parentId);
      if (expected.attachments) {
        expect(post.attachments).toHaveLength(expected.attachments.length);
        expected.attachments.forEach((attachment: Record<string, unknown>, index: number) => {
          expect(post.attachments[index]).toMatchObject(attachment);
        });
      }
    } else if (classified.type === "state") {
      expect(classified.targetId).toBe(expected.targetId);
      if (expected.stateKind) expect(classified.update.kind).toBe(expected.stateKind);
    } else if (classified.type === "deletion") {
      expect(classified.byPubkey).toBe(expected.byPubkey);
      expect(classified.targetIds).toEqual(expected.targetIds);
    } else if (classified.type === "person") {
      const person = classified.person;
      if (expected.displayName) expect(person.displayName).toBe(expected.displayName);
      if (expected.personName) expect(person.name).toBe(expected.personName);
      if (expected.about) expect(person.about).toBe(expected.about);
      if (expected.nip05) expect(person.nip05).toBe(expected.nip05);
    } else if (classified.type === "topic") {
      const topic = classified.topic;
      if (expected.topicId) expect(topic.id).toBe(expected.topicId);
      if (expected.topicName) expect(topic.name).toBe(expected.topicName);
      if (expected.primary) expect(topic.primary).toBe(expected.primary);
    } else if (classified.type === "calendarEvent") {
      expect(classified.event).toMatchObject(expected.calendar as Record<string, unknown>);
    }
  });
});
