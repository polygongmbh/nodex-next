// Per-account, device-local preferences: onboarding completion plus pinned
// channels and pinned topics (both by name/slug). Topics themselves are
// SHARED relay events (kind 30177) — only the pinned state is personal, so
// only that is stored here. Malformed entries are rejected, not migrated;
// optional fields absent in older entries are not malformed.

interface StoredPreferences {
  onboarded: boolean;
  pinnedChannels: string[];
  pinnedTopics?: string[];
}

function storageKey(pubkey: string): string {
  return `nodex-next.prefs.v1.${pubkey}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isStoredPreferences(value: unknown): value is StoredPreferences {
  if (typeof value !== "object" || value === null) return false;
  const prefs = value as Record<string, unknown>;
  return (
    typeof prefs.onboarded === "boolean" &&
    isStringArray(prefs.pinnedChannels) &&
    (prefs.pinnedTopics === undefined || isStringArray(prefs.pinnedTopics))
  );
}

function readStorage(pubkey: string): StoredPreferences | null {
  try {
    const raw = localStorage.getItem(storageKey(pubkey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredPreferences(parsed)) {
      localStorage.removeItem(storageKey(pubkey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

class PreferencesStore {
  onboarded = $state(false);
  pinnedChannels = $state<string[]>([]);
  pinnedTopics = $state<string[]>([]);
  private pubkey: string | null = null;

  load(pubkey: string): void {
    this.pubkey = pubkey;
    const stored = readStorage(pubkey);
    this.onboarded = stored?.onboarded ?? false;
    this.pinnedChannels = stored?.pinnedChannels ?? [];
    this.pinnedTopics = stored?.pinnedTopics ?? [];
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

  completeOnboarding(pinnedChannels: string[]): void {
    this.onboarded = true;
    this.pinnedChannels = pinnedChannels.map((channel) => channel.toLowerCase());
    this.persist();
  }

  togglePinned(name: string): void {
    const normalized = name.toLowerCase();
    this.pinnedChannels = this.pinnedChannels.includes(normalized)
      ? this.pinnedChannels.filter((channel) => channel !== normalized)
      : [...this.pinnedChannels, normalized];
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
    this.pinnedChannels = [];
    this.pinnedTopics = [];
  }
}

export const preferencesStore = new PreferencesStore();
