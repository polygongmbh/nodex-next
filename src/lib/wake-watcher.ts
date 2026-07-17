// Detects wake-from-sleep, tab re-focus and network restore, and asks the
// session to resync its relay service. Needed because NDK cannot recover on
// its own: after a reconnect it never re-sends the REQs of already-RUNNING
// subscriptions (the timeline goes silently stale), and a relay parked in
// FLAPPING state refuses further connect() calls entirely.

/** A browser signal that the machine or tab may have been away. */
export type WakeSignal =
  | { type: "online" }
  | { type: "visible"; hiddenMs: number }
  | { type: "tick"; gapMs: number };

/** Hidden this long, a re-shown tab refetches even if sockets look healthy. */
const HIDDEN_REFETCH_MS = 60_000;
/** Timer-gap watchdog: a tick arriving this late means the system slept. */
const TICK_INTERVAL_MS = 30_000;
const TICK_GAP_MS = 90_000;
/** Collapse bursts (online + focus + visible fire together on wake). */
const THROTTLE_MS = 10_000;

/**
 * Whether a wake signal warrants a resync. Network restore, a long-hidden tab
 * and a slept system always do (subscriptions may be dead with sockets green);
 * a brief tab switch only does when a relay is actually offline.
 */
export function shouldResync(signal: WakeSignal, anyRelayOffline: boolean): boolean {
  switch (signal.type) {
    case "online":
      return true;
    case "visible":
      return signal.hiddenMs >= HIDDEN_REFETCH_MS || anyRelayOffline;
    case "tick":
      return signal.gapMs >= TICK_GAP_MS;
  }
}

/**
 * Listen for wake signals and call `resync` (throttled) when one warrants it.
 * Returns a cleanup function.
 */
export function startWakeWatcher(params: {
  anyRelayOffline(): boolean;
  resync(): void;
}): () => void {
  let hiddenAt: number | null = null;
  let lastTick = Date.now();
  let lastResync = 0;

  const handle = (signal: WakeSignal) => {
    if (!shouldResync(signal, params.anyRelayOffline())) return;
    const now = Date.now();
    if (now - lastResync < THROTTLE_MS) return;
    lastResync = now;
    params.resync();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    handle({ type: "visible", hiddenMs: hiddenAt ? Date.now() - hiddenAt : 0 });
    hiddenAt = null;
  };
  const onOnline = () => handle({ type: "online" });
  const watchdog = setInterval(() => {
    const now = Date.now();
    const gapMs = now - lastTick;
    lastTick = now;
    handle({ type: "tick", gapMs });
  }, TICK_INTERVAL_MS);

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
    clearInterval(watchdog);
  };
}
