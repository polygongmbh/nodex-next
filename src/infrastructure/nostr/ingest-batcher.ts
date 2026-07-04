// Decouples relay delivery rate from render rate during hydration. The
// backfill can stream thousands of events; applying each one individually
// rebuilds the reactive timeline per event and makes scrolling jitter. The
// batcher buffers events in a plain array and flushes them in coarse chunks:
// a fast first flush so the screen populates immediately, then interval
// flushes until EOSE settles it into immediate pass-through for live traffic.

import type { RawNostrEvent } from "@/domain/event-to-post";

export interface IngestBatcher {
  push(raw: RawNostrEvent, relayUrl: string | undefined): void;
  /** Flush everything buffered and switch to immediate pass-through. */
  settle(): void;
  /** Drop buffered events and cancel timers (session teardown). */
  dispose(): void;
}

const FIRST_FLUSH_MS = 50;
const FLUSH_INTERVAL_MS = 500;

export function createIngestBatcher(
  apply: (raw: RawNostrEvent, relayUrl: string | undefined) => void
): IngestBatcher {
  let buffer: Array<[RawNostrEvent, string | undefined]> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let flushedOnce = false;

  const flush = () => {
    timer = null;
    flushedOnce = true;
    const batch = buffer;
    buffer = [];
    for (const [raw, relayUrl] of batch) apply(raw, relayUrl);
  };

  return {
    push(raw, relayUrl) {
      if (settled) {
        apply(raw, relayUrl);
        return;
      }
      buffer.push([raw, relayUrl]);
      if (timer === null) {
        timer = setTimeout(flush, flushedOnce ? FLUSH_INTERVAL_MS : FIRST_FLUSH_MS);
      }
    },
    settle() {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      flush();
    },
    dispose() {
      settled = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      buffer = [];
    },
  };
}
