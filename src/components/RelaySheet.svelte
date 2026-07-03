<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { relayColorSlot } from "@/domain/relay-identity";

  let { postId, onClose }: { postId: string; onClose: () => void } = $props();

  const post = $derived(timelineStore.postsById[postId]);
  const entries = $derived(
    (post?.relays ?? []).map((relayId) => {
      const known = timelineStore.relays.find((relay) => relay.id === relayId);
      return {
        id: relayId,
        name: known?.name ?? relayId,
        url: known?.url ?? "",
        connected: known?.connected ?? false,
        slot: relayColorSlot(relayId),
      };
    })
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="sheet" data-testid="relay-sheet">
  <div class="grip"></div>
  <h2>{t("relaysheet.title")}</h2>
  <ul>
    {#each entries as relay (relay.id)}
      <li>
        <span class="dot" style="background: var(--relay-{relay.slot})"></span>
        <div class="names">
          <span class="name">{relay.name}</span>
          {#if relay.url}<span class="url">{relay.url}</span>{/if}
        </div>
        <span class="state" class:online={relay.connected}>
          {relay.connected ? t("menu.connected") : t("space.offline")}
        </span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 32rem;
    margin-inline: auto;
    z-index: 41;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    animation: slide-up 200ms ease-out;
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .grip {
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin: 0.25rem auto 0.75rem;
  }
  h2 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-weight: 600;
  }
  .url {
    font-size: 0.75rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .state {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .state.online {
    color: var(--relay-1);
  }
</style>
