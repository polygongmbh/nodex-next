// Reachability side of space auto-detection: turn a noas host into a concrete
// space by probing candidate relay URLs and adopting the first that answers.
// The candidate derivation is pure (domain/space-probe); only the probe — a
// WebSocket that opens — lives here. A WebSocket open needs no CORS and settles
// before any relay auth, so it is a truer "is this a relay host" signal than a
// NIP-11 fetch would be. Mirrors nodex's host-fallback probe.

import { spaceProbeCandidates } from "@/domain/space-probe";

const DEFAULT_SUBDOMAINS = ["tasks", "feed", "relay", "nostr"];
const PROBE_TIMEOUT_MS = 1500;

/** Configured probe subdomains, `VITE_SPACE_PROBE_SUBDOMAINS` (csv) or default. */
export function spaceProbeSubdomains(): string[] {
  const configured = (import.meta.env.VITE_SPACE_PROBE_SUBDOMAINS as string | undefined)
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return configured && configured.length > 0 ? configured : DEFAULT_SUBDOMAINS;
}

/** Resolve to true if a WebSocket to `url` opens within the timeout. */
export function probeRelay(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: WebSocket | null = null;
    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // Closing a half-open socket can throw; the result is already decided.
      }
      resolve(reachable);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      socket = new WebSocket(url);
      socket.onopen = () => finish(true);
      socket.onerror = () => finish(false);
      socket.onclose = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

/**
 * The first reachable space under the noas host's root domain, or null when no
 * candidate answers. Candidates are probed in parallel but priority order (the
 * configured subdomain order) decides the winner, so `tasks.<root>` beats a
 * generic `nostr.<root>` when both are up.
 */
export async function detectSpace(
  host: string,
  subdomains: string[] = spaceProbeSubdomains(),
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<string | null> {
  const candidates = spaceProbeCandidates(host, subdomains);
  if (candidates.length === 0) return null;
  const results = await Promise.all(
    candidates.map((url) => probeRelay(url, timeoutMs).then((reachable) => ({ url, reachable })))
  );
  return results.find((result) => result.reachable)?.url ?? null;
}
