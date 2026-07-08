// NDK wrapper. NDK is used for what it is good at — relay pool, signing,
// subscription lifecycle — while event/profile state lives in our own stores:
// NDK's event cache dedupes by id and loses which relays delivered an event,
// and per-relay attribution is a core Nodex feature. Attribution works by
// listening to BOTH `event` (first delivery) and `event:dup` (same event from
// another relay) and unioning relay urls in the timeline store.

import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKRelaySet,
  type NDKKind,
  type NDKRelay,
  type NDKSubscription,
  type NostrEvent,
} from "@nostr-dev-kit/ndk";
import {
  CONTENT_SUBSCRIPTION_FILTERS,
  PROFILE_SUBSCRIPTION_FILTERS,
} from "@/domain/nostr-kinds";
import type { RawNostrEvent } from "@/domain/event-to-post";

export interface NdkServiceHandlers {
  onEvent(event: RawNostrEvent, relayUrl: string | undefined): void;
  onRelayStatus(relayUrl: string, connected: boolean): void;
  onEose(): void;
}

export interface NdkService {
  /** Publish to the given relays; resolves once at least one relay acks. */
  publish(params: {
    kind: number;
    content: string;
    tags: string[][];
    relayUrls: string[];
  }): Promise<void>;
  /**
   * One-shot fetch of the newest kind-0 profile event; scoped to specific
   * relays when given (per-space profiles), all relays otherwise.
   */
  fetchProfileEvent(pubkeyHex: string, relayUrls?: string[]): Promise<RawNostrEvent | null>;
  /** One-shot fetch of the newest kind-0 per author, for backfilling gaps. */
  fetchProfileEvents(pubkeyHexes: string[]): Promise<RawNostrEvent[]>;
  stop(): void;
}

// NDK's fetchEvents() only ever resolves via the subscription's `onEose` —
// it has no internal timeout, so a relay that never connects or never sends
// EOSE hangs the caller forever (surfaced as onboarding's profile step never
// leaving "Fetching your existing profile…"). Resolve to `fallback` instead.
const PROFILE_FETCH_TIMEOUT_MS = 3000;
function withTimeout<T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

// `event:dup` can emit a raw NostrEvent (no rawEvent()) when the duplicate
// came in via NDK's subscription manager — normalize both shapes.
function toRawEvent(event: NDKEvent | NostrEvent): RawNostrEvent | null {
  const raw =
    typeof (event as NDKEvent).rawEvent === "function"
      ? (event as NDKEvent).rawEvent()
      : (event as NostrEvent);
  if (!raw.id || !raw.pubkey || typeof raw.kind !== "number") return null;
  return {
    id: raw.id,
    pubkey: raw.pubkey,
    kind: raw.kind,
    content: raw.content ?? "",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[][]) : [],
    created_at: raw.created_at ?? 0,
  };
}

export function startNdkService(
  relayUrls: string[],
  privateKeyHex: string,
  handlers: NdkServiceHandlers
): NdkService {
  const ndk = new NDK({
    explicitRelayUrls: relayUrls,
    // NDK would otherwise fetch kind 3/10002 on signer set and silently
    // connect extra relays, bypassing our relay tracking; outbox mode pins
    // hardwired public relays. Both off, as in nodex.
    autoConnectUserRelays: false,
    enableOutboxModel: false,
  });
  ndk.signer = new NDKPrivateKeySigner(privateKeyHex);

  ndk.pool.on("relay:connect", (relay: NDKRelay) => handlers.onRelayStatus(relay.url, true));
  ndk.pool.on("relay:disconnect", (relay: NDKRelay) => handlers.onRelayStatus(relay.url, false));

  void ndk.connect();

  const subscriptionOptions = {
    closeOnEose: false,
    // We echo our own publishes with the ack'ing relay instead (see publish
    // below); NDK's optimistic dispatch has relay=undefined.
    skipOptimisticPublishEvent: true,
  };
  const toFilters = (filters: { kinds: number[]; limit: number }[]) =>
    filters.map((filter) => ({ kinds: filter.kinds as NDKKind[], limit: filter.limit }));

  const attachEventHandlers = (subscription: NDKSubscription) => {
    subscription.on("event", (event: NDKEvent, relay?: NDKRelay) => {
      const raw = toRawEvent(event);
      if (raw) handlers.onEvent(raw, relay?.url ?? event.relay?.url);
    });
    subscription.on("event:dup", (event: NDKEvent | NostrEvent, relay?: NDKRelay) => {
      const raw = toRawEvent(event);
      if (raw) handlers.onEvent(raw, relay?.url);
    });
  };

  // Profiles first: their REQ goes out before the content REQ, so kind-0
  // events stream on their own lane instead of behind the post backfill.
  const profileSubscription = ndk.subscribe(
    toFilters(PROFILE_SUBSCRIPTION_FILTERS),
    subscriptionOptions
  );
  attachEventHandlers(profileSubscription);

  const contentSubscription = ndk.subscribe(
    toFilters(CONTENT_SUBSCRIPTION_FILTERS),
    subscriptionOptions
  );
  attachEventHandlers(contentSubscription);
  contentSubscription.on("eose", () => handlers.onEose());

  return {
    async fetchProfileEvent(pubkeyHex, relayUrls) {
      const relaySet = relayUrls?.length
        ? NDKRelaySet.fromRelayUrls(relayUrls, ndk)
        : undefined;
      const events = await withTimeout(
        ndk.fetchEvents({ kinds: [0 as NDKKind], authors: [pubkeyHex] }, undefined, relaySet),
        new Set<NDKEvent>(),
        PROFILE_FETCH_TIMEOUT_MS
      );
      let newest: NDKEvent | null = null;
      for (const event of events) {
        if (!newest || (event.created_at ?? 0) > (newest.created_at ?? 0)) newest = event;
      }
      return newest ? toRawEvent(newest) : null;
    },
    async fetchProfileEvents(pubkeyHexes) {
      if (pubkeyHexes.length === 0) return [];
      const events = await withTimeout(
        ndk.fetchEvents({ kinds: [0 as NDKKind], authors: pubkeyHexes }),
        new Set<NDKEvent>(),
        PROFILE_FETCH_TIMEOUT_MS
      );
      const newestByAuthor = new Map<string, NDKEvent>();
      for (const event of events) {
        const existing = newestByAuthor.get(event.pubkey);
        if (!existing || (event.created_at ?? 0) > (existing.created_at ?? 0)) {
          newestByAuthor.set(event.pubkey, event);
        }
      }
      return Array.from(newestByAuthor.values())
        .map((event) => toRawEvent(event))
        .filter((raw): raw is RawNostrEvent => raw !== null);
    },
    async publish({ kind, content, tags, relayUrls }) {
      const event = new NDKEvent(ndk);
      event.kind = kind;
      event.content = content;
      event.tags = tags;
      await event.sign();
      const relaySet = NDKRelaySet.fromRelayUrls(relayUrls, ndk);
      await event.publish(relaySet, 10_000, 1);
      // Optimistic echo attributed to the target relays, so the fresh post
      // renders immediately with correct attribution dots.
      const raw = toRawEvent(event);
      if (raw) for (const relayUrl of relayUrls) handlers.onEvent(raw, relayUrl);
    },
    stop() {
      profileSubscription.stop();
      contentSubscription.stop();
      ndk.pool.removeAllListeners();
      ndk.pool.relays.forEach((relay) => relay.disconnect());
    },
  };
}
