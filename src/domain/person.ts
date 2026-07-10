/**
 * The parsed kind-0 content, kept verbatim (NDK's NDKUserProfile shape mirrored
 * structurally so the domain layer stays NDK-import-free): typed known keys plus
 * an index signature so unknown keys (lud16, banner, custom fields) survive a
 * round-trip. Keys are NIP-01 wire format (`display_name`, never camelCase);
 * values are trimmed/coerced only at read time, never at parse time.
 */
export interface ProfileContent {
  [key: string]: unknown;
  name?: string;
  display_name?: string;
  nip05?: string;
  picture?: string;
  about?: string;
  website?: string;
  banner?: string;
  lud16?: string;
  lud06?: string;
}

export interface Person {
  pubkey: string;
  /** created_at of the kind-0 event this profile came from; newer wins. */
  metadataTimestamp: number;
  /** The full parsed kind-0 content JSON, verbatim. */
  profile: ProfileContent;
}

/**
 * Parse a kind-0 `content` string into ProfileContent, verbatim. Malformed
 * JSON and non-object bodies (number, array, null) are not profiles → null.
 */
export function parseProfileContent(json: string): ProfileContent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as ProfileContent;
}

const trimmed = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

// Wire-alias tolerance lives here (read time), not in the stored content: the
// old parseMetadata accepted camelCase `displayName` and `username` fallbacks.
function contentDisplayName(content: Record<string, unknown>): string {
  return trimmed(content.display_name) || trimmed(content.displayName);
}
function contentName(content: Record<string, unknown>): string {
  return trimmed(content.name) || trimmed(content.username);
}

/** Trimmed display_name (with camelCase fallback), or "" when absent. */
export function personDisplayName(person: Person | undefined): string {
  return person ? contentDisplayName(person.profile) : "";
}
/** Trimmed name/username (with fallback), or "" when absent. */
export function personName(person: Person | undefined): string {
  return person ? contentName(person.profile) : "";
}
export function personNip05(person: Person | undefined): string {
  return trimmed(person?.profile.nip05);
}
export function personPicture(person: Person | undefined): string {
  return trimmed(person?.profile.picture);
}
export function personAbout(person: Person | undefined): string {
  return trimmed(person?.profile.about);
}
export function personWebsite(person: Person | undefined): string {
  return trimmed(person?.profile.website);
}

/** Fallback chain for the visible author label. */
export function personLabel(person: Person | undefined, pubkey: string): string {
  if (person) {
    const candidate =
      contentDisplayName(person.profile) ||
      contentName(person.profile) ||
      personNip05(person).split("@")[0];
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
export function mergeProfileContent(base: ProfileContent, edits: ProfileEdits): ProfileContent {
  const merged: ProfileContent = { ...base };
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
  return {
    name: contentName(content),
    displayName: contentDisplayName(content),
    about: trimmed(content.about),
    picture: trimmed(content.picture),
    website: trimmed(content.website),
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
