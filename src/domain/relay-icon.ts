// Host-based relay (space) icon resolution. Mirrors the original Nodex
// `resolveRelayIcon`: a relay's icon is picked from its hostname prefix, with a
// stable hash fallback so every relay gets a deterministic, recognizable glyph.
// Kept dependency-free (domain layer) — the SvG rendering lives in SpaceIcon.

import { normalizeRelayUrl } from "./relay-identity";

/** Glyph keys rendered by SpaceIcon.svelte. */
export type RelayIconKey =
  | "play"
  | "rss"
  | "list"
  | "plane"
  | "building"
  | "tower"
  | "cpu"
  | "users"
  | "game"
  | "radio";

// Hostname prefix → glyph (e.g. feed.example.com → "rss").
const PREFIX_ICON_MAP: Record<string, RelayIconKey> = {
  demo: "play",
  feed: "rss",
  tasks: "list",
  travel: "plane",
  base: "building",
  relay: "tower",
  nostr: "cpu",
};

// Deterministic fallback when the prefix is unknown; order is stable so a
// relay's glyph never changes between sessions.
const HASH_FALLBACK_ICONS: RelayIconKey[] = ["building", "users", "game", "cpu", "radio"];

function extractRelayHostPrefix(url: string): string {
  const normalized = normalizeRelayUrl(url);
  if (!normalized) return "";
  try {
    return new URL(normalized).hostname.split(".").filter(Boolean)[0]?.toLowerCase() ?? "";
  } catch {
    const noProtocol = normalized.replace(/^[a-z]+:\/\//i, "");
    return noProtocol.split(/[./:?#]/).filter(Boolean)[0]?.toLowerCase() ?? "";
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Stable glyph key for a relay, from its host prefix or a hash fallback. */
export function resolveRelayIcon(url: string): RelayIconKey {
  const prefix = extractRelayHostPrefix(url);
  const mapped = prefix ? PREFIX_ICON_MAP[prefix] : undefined;
  if (mapped) return mapped;
  const seed = prefix || normalizeRelayUrl(url).toLowerCase() || url.toLowerCase();
  return HASH_FALLBACK_ICONS[hashString(seed) % HASH_FALLBACK_ICONS.length];
}
