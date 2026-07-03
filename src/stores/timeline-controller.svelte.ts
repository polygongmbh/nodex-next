// Wires the authenticated session to the NDK service and the timeline store.
// Exposes commands only (start/stop/sendMessage); state lives in the stores.

import { NOSTR_KINDS } from "@/domain/nostr-kinds";
import {
  buildMessageTags,
  PublishRuleError,
  resolveDraftChannels,
  resolvePublishRelay,
} from "@/domain/publish-rules";
import { startNdkService, type NdkService } from "@/infrastructure/nostr/ndk-service";
import type { StoredSession } from "@/infrastructure/noas/session";
import { filterStore } from "./filters.svelte";
import { timelineStore } from "./timeline.svelte";

class TimelineController {
  draft = $state("");
  private service: NdkService | null = null;

  start(session: StoredSession): void {
    if (this.service) return;
    timelineStore.initRelays(session.relayUrls);
    this.service = startNdkService(session.relayUrls, session.privateKeyHex, {
      onEvent: (event, relayUrl) => timelineStore.ingestEvent(event, relayUrl),
      onRelayStatus: (relayUrl, connected) => timelineStore.setRelayConnected(relayUrl, connected),
      onEose: () => timelineStore.markHydrated(),
    });
  }

  stop(): void {
    this.service?.stop();
    this.service = null;
    timelineStore.reset();
    filterStore.reset();
    this.draft = "";
  }

  get draftChannels(): string[] {
    return resolveDraftChannels(this.draft, filterStore.includedChannels);
  }

  /**
   * Publish the draft as a kind-1 message. Returns the target relay id.
   * Throws PublishRuleError with a user-readable message on rule violations.
   */
  async sendMessage(): Promise<string> {
    if (!this.service) throw new PublishRuleError("Not connected yet.");
    const content = this.draft.trim();
    if (!content) throw new PublishRuleError("Write a message first.");
    const channels = this.draftChannels;
    const tags = buildMessageTags(channels);
    const relay = resolvePublishRelay(timelineStore.relays, filterStore.activeRelayId);
    await this.service.publish({
      kind: NOSTR_KINDS.message,
      content,
      tags,
      relayUrl: relay.url,
    });
    this.draft = "";
    return relay.id;
  }
}

export const timelineController = new TimelineController();
