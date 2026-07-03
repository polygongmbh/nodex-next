<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";

  // Empty selection = "All spaces" (no relay filter), never "no relays".
  function onChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    filterStore.selectSpace(value || null);
  }

  const connectedCount = $derived(
    timelineStore.relays.filter((relay) => relay.connected).length
  );
</script>

<div class="selector">
  <select value={filterStore.activeRelayId ?? ""} onchange={onChange} data-testid="space-selector">
    <option value="">{t("space.all")}</option>
    {#each timelineStore.relays as relay (relay.id)}
      <option value={relay.id}>
        {relay.name}{relay.connected ? "" : ` (${t("space.offline")})`}
      </option>
    {/each}
  </select>
  <span class="status" class:online={connectedCount > 0}>
    {connectedCount}/{timelineStore.relays.length}
  </span>
</div>

<style>
  .selector {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }
  select {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    font-size: 0.9rem;
    font-weight: 600;
    max-width: 11rem;
    text-overflow: ellipsis;
  }
  .status {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .status.online {
    color: var(--relay-1);
  }
</style>
