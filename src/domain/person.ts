export interface Person {
  pubkey: string;
  name?: string;
  displayName?: string;
  nip05?: string;
  picture?: string;
  about?: string;
  website?: string;
  /** created_at of the kind-0 event this profile came from; newer wins. */
  metadataTimestamp: number;
}

/** Fallback chain for the visible author label. */
export function personLabel(person: Person | undefined, pubkey: string): string {
  if (person) {
    const candidate =
      person.displayName?.trim() ||
      person.name?.trim() ||
      person.nip05?.split("@")[0]?.trim();
    if (candidate) return candidate;
  }
  return `${pubkey.slice(0, 8)}…`;
}

export function personInitials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

/**
 * The display name a fresh profile defaults to: the username with an
 * upper-cased initial (`alice` → `Alice`). Empty stays empty; an already
 * capitalized or non-letter initial is left untouched. Overridden by an
 * existing kind-0. Contract: spec/vectors/noas.json `defaultDisplayName`.
 */
export function defaultDisplayName(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export interface ProfileEdits {
  displayName: string;
  name?: string;
  about?: string;
  picture?: string;
  website?: string;
}

/**
 * Merge profile edits into the existing kind-0 content: unknown fields
 * (lud16, banner, …) survive untouched, edited fields override, and fields
 * the user cleared are removed.
 */
export function mergeProfileContent(
  base: Record<string, unknown>,
  edits: ProfileEdits
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  merged.display_name = edits.displayName;
  if (edits.name?.trim()) merged.name = edits.name.trim();
  for (const [key, value] of [
    ["about", edits.about],
    ["picture", edits.picture],
    ["website", edits.website],
  ] as const) {
    if (value === undefined) continue;
    if (value.trim()) merged[key] = value.trim();
    else delete merged[key];
  }
  return merged;
}

/**
 * The trimmed string fields of a parsed kind-0 content record, for
 * prefilling profile editors — the read counterpart of mergeProfileContent.
 * Non-string and missing values coerce to "".
 */
export function parseProfileFields(content: Record<string, unknown>): {
  name: string;
  displayName: string;
  about: string;
  picture: string;
  website: string;
} {
  const text = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  return {
    name: text(content.name),
    displayName: text(content.display_name),
    about: text(content.about),
    picture: text(content.picture),
    website: text(content.website),
  };
}

/**
 * Whether a fetched kind-0 (`fetchOwnProfile()`'s parsed content) represents
 * an existing profile — any content at all, since the object only comes back
 * non-empty when an event was actually found on the relay.
 */
export function hasExistingProfileContent(content: Record<string, unknown>): boolean {
  return Object.keys(content).length > 0;
}

/** Stable hue for avatar placeholder backgrounds, derived from the pubkey. */
export function pubkeyHue(pubkey: string): number {
  let hash = 0;
  for (let index = 0; index < pubkey.length; index += 1) {
    hash = (hash * 31 + pubkey.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}
