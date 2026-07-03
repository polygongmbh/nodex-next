// Per-account preferences: onboarding completion and pinned channels (the
// channels picked for the main feed). Persisted per pubkey; malformed entries
// are rejected, not migrated.

interface StoredPreferences {
  onboarded: boolean;
  pinnedChannels: string[];
}

function storageKey(pubkey: string): string {
  return `nodex-next.prefs.v1.${pubkey}`;
}

function isStoredPreferences(value: unknown): value is StoredPreferences {
  if (typeof value !== "object" || value === null) return false;
  const prefs = value as Record<string, unknown>;
  return (
    typeof prefs.onboarded === "boolean" &&
    Array.isArray(prefs.pinnedChannels) &&
    prefs.pinnedChannels.every((channel) => typeof channel === "string")
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
  private pubkey: string | null = null;

  load(pubkey: string): void {
    this.pubkey = pubkey;
    const stored = readStorage(pubkey);
    this.onboarded = stored?.onboarded ?? false;
    this.pinnedChannels = stored?.pinnedChannels ?? [];
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
        JSON.stringify({ onboarded: this.onboarded, pinnedChannels: this.pinnedChannels })
      );
    } catch {
      // Storage unavailable (private mode) — preferences stay session-only.
    }
  }

  reset(): void {
    this.pubkey = null;
    this.onboarded = false;
    this.pinnedChannels = [];
  }
}

export const preferencesStore = new PreferencesStore();
