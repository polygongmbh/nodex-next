// Per-account, device-local preferences: onboarding completion, pinned
// topics (slugs), and pinned channels — PER SPACE: each pinned channel maps
// to the relay ids it is pinned for. Topics themselves are SHARED relay
// events (kind 30177) — only the pinned state is personal. Malformed FIELDS
// are rejected (dropped to their empty value), never migrated; the whole
// entry survives so `onboarded` is not lost when one field's shape changed.

interface StoredPreferences {
  onboarded: boolean;
  /** channel name → relay ids the pin applies to */
  pinnedChannels: Record<string, string[]>;
  pinnedTopics: string[];
}

function storageKey(pubkey: string): string {
  return `nodex-next.prefs.v1.${pubkey}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function readPinnedChannels(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string[]] => isStringArray(entry[1]) && entry[1].length > 0
  );
  return Object.fromEntries(entries);
}

function readStorage(pubkey: string): StoredPreferences | null {
  try {
    const raw = localStorage.getItem(storageKey(pubkey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const prefs = parsed as Record<string, unknown>;
    return {
      onboarded: prefs.onboarded === true,
      pinnedChannels: readPinnedChannels(prefs.pinnedChannels),
      pinnedTopics: isStringArray(prefs.pinnedTopics) ? prefs.pinnedTopics : [],
    };
  } catch {
    return null;
  }
}

class PreferencesStore {
  onboarded = $state(false);
  /** channel name → relay ids the pin applies to */
  pinnedChannels = $state<Record<string, string[]>>({});
  pinnedTopics = $state<string[]>([]);
  private pubkey: string | null = null;

  load(pubkey: string): void {
    this.pubkey = pubkey;
    const stored = readStorage(pubkey);
    this.onboarded = stored?.onboarded ?? false;
    this.pinnedChannels = stored?.pinnedChannels ?? {};
    this.pinnedTopics = stored?.pinnedTopics ?? [];
  }

  pinChannel(name: string, relayIds: string[]): void {
    if (relayIds.length === 0) return;
    const existing = this.pinnedChannels[name] ?? [];
    this.pinnedChannels = {
      ...this.pinnedChannels,
      [name]: Array.from(new Set([...existing, ...relayIds])),
    };
    this.persist();
  }

  unpinChannel(name: string, relayIds: string[]): void {
    const remaining = (this.pinnedChannels[name] ?? []).filter(
      (relayId) => !relayIds.includes(relayId)
    );
    const { [name]: _dropped, ...rest } = this.pinnedChannels;
    this.pinnedChannels = remaining.length > 0 ? { ...rest, [name]: remaining } : rest;
    this.persist();
  }

  isChannelPinned(name: string, scopeRelayIds: string[]): boolean {
    const pinnedFor = this.pinnedChannels[name] ?? [];
    return scopeRelayIds.some((relayId) => pinnedFor.includes(relayId));
  }

  /** Channel names pinned for at least one of the scoped spaces. */
  pinnedChannelNamesFor(scopeRelayIds: string[]): string[] {
    return Object.keys(this.pinnedChannels).filter((name) =>
      this.isChannelPinned(name, scopeRelayIds)
    );
  }

  togglePinnedTopic(topicId: string): void {
    this.pinnedTopics = this.pinnedTopics.includes(topicId)
      ? this.pinnedTopics.filter((id) => id !== topicId)
      : [...this.pinnedTopics, topicId];
    this.persist();
  }

  isTopicPinned(topicId: string): boolean {
    return this.pinnedTopics.includes(topicId);
  }

  /** channel name → relay ids to pin it for (computed by the caller). */
  completeOnboarding(pinnedChannels: Record<string, string[]>): void {
    this.onboarded = true;
    this.pinnedChannels = Object.fromEntries(
      Object.entries(pinnedChannels)
        .filter(([, relayIds]) => relayIds.length > 0)
        .map(([name, relayIds]) => [name.toLowerCase(), relayIds])
    );
    this.persist();
  }

  private persist(): void {
    if (!this.pubkey) return;
    try {
      localStorage.setItem(
        storageKey(this.pubkey),
        JSON.stringify({
          onboarded: this.onboarded,
          pinnedChannels: this.pinnedChannels,
          pinnedTopics: this.pinnedTopics,
        })
      );
    } catch {
      // Storage unavailable (private mode) — preferences stay session-only.
    }
  }

  reset(): void {
    this.pubkey = null;
    this.onboarded = false;
    this.pinnedChannels = {};
    this.pinnedTopics = [];
  }
}

export const preferencesStore = new PreferencesStore();
