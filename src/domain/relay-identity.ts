// Relay identity helpers. Kept dependency-free (no NDK import) so the domain
// layer stays portable; the canonical form matches NDK's (trailing slash on
// bare origins) so ids line up with pool keys.

export function normalizeRelayUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function stripRelayProtocol(url: string): string {
  return normalizeRelayUrl(url).replace(/^wss?:\/\//, "");
}

/** Stable id: normalized URL minus scheme, dots/slashes flattened. */
export function relayUrlToId(url: string): string {
  return stripRelayProtocol(url).toLowerCase().replace(/\/+$/, "").replace(/[./]/g, "-");
}

const COMMON_PREFIXES = new Set(["feed", "nostr", "relay", "nos", "wss"]);

/** Human name: hostname minus common relay prefixes and the TLD. */
export function relayDisplayName(url: string): string {
  const normalized = normalizeRelayUrl(url);
  if (!normalized) return url;
  let host: string;
  try {
    host = new URL(normalized).hostname.toLowerCase();
  } catch {
    return stripRelayProtocol(url);
  }
  const labels = host.split(".").filter(Boolean);
  while (labels.length > 1 && COMMON_PREFIXES.has(labels[0])) {
    labels.shift();
  }
  if (labels.length > 1) labels.pop();
  return labels.join(".") || host;
}

export const RELAY_COLOR_SLOTS = 8;

/** Stable palette slot (0–7) per relay id, for attribution dots. */
export function relayColorSlot(relayId: string): number {
  let hash = 0;
  for (let index = 0; index < relayId.length; index += 1) {
    hash = (hash * 33 + relayId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % RELAY_COLOR_SLOTS;
}
