export interface Person {
  pubkey: string;
  name?: string;
  displayName?: string;
  nip05?: string;
  picture?: string;
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

/** Stable hue for avatar placeholder backgrounds, derived from the pubkey. */
export function pubkeyHue(pubkey: string): number {
  let hash = 0;
  for (let index = 0; index < pubkey.length; index += 1) {
    hash = (hash * 31 + pubkey.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}
