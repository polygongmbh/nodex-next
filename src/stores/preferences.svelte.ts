// Per-account preferences: onboarding completion, pinned channels, and
// topics (named tag combinations). Persisted per pubkey; malformed entries
// are rejected, not migrated. `topics` is optional in the validator so
// entries written before the field existed stay valid — absent ≠ malformed.

import type { Topic } from "@/domain/channel";

interface StoredPreferences {
  onboarded: boolean;
  pinnedChannels: string[];
  topics?: Topic[];
}

function storageKey(pubkey: string): string {
  return `nodex-next.prefs.v1.${pubkey}`;
}

function isTopic(value: unknown): value is Topic {
  if (typeof value !== "object" || value === null) return false;
  const topic = value as Record<string, unknown>;
  return (
    typeof topic.id === "string" &&
    typeof topic.name === "string" &&
    typeof topic.pinned === "boolean" &&
    Array.isArray(topic.tags) &&
    topic.tags.length > 0 &&
    topic.tags.every((tag) => typeof tag === "string")
  );
}

function isStoredPreferences(value: unknown): value is StoredPreferences {
  if (typeof value !== "object" || value === null) return false;
  const prefs = value as Record<string, unknown>;
  return (
    typeof prefs.onboarded === "boolean" &&
    Array.isArray(prefs.pinnedChannels) &&
    prefs.pinnedChannels.every((channel) => typeof channel === "string") &&
    (prefs.topics === undefined || (Array.isArray(prefs.topics) && prefs.topics.every(isTopic)))
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
  topics = $state<Topic[]>([]);
  private pubkey: string | null = null;

  load(pubkey: string): void {
    this.pubkey = pubkey;
    const stored = readStorage(pubkey);
    this.onboarded = stored?.onboarded ?? false;
    this.pinnedChannels = stored?.pinnedChannels ?? [];
    this.topics = stored?.topics ?? [];
  }

  createTopic(name: string, tags: string[]): Topic {
    const topic: Topic = {
      id: crypto.randomUUID(),
      name: name.trim(),
      tags: Array.from(new Set(tags.map((tag) => tag.toLowerCase()))),
      pinned: false,
    };
    this.topics = [...this.topics, topic];
    this.persist();
    return topic;
  }

  deleteTopic(id: string): void {
    this.topics = this.topics.filter((topic) => topic.id !== id);
    this.persist();
  }

  toggleTopicPinned(id: string): void {
    this.topics = this.topics.map((topic) =>
      topic.id === id ? { ...topic, pinned: !topic.pinned } : topic
    );
    this.persist();
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
          topics: this.topics,
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
    this.topics = [];
  }
}

export const preferencesStore = new PreferencesStore();
