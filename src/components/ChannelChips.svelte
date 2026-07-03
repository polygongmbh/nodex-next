<script lang="ts">
  import { deriveChannels, partitionPinnedChannels } from "@/domain/channel";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";

  // Channels come from ALL posts (unfiltered) so chips don't vanish while
  // filtering narrows the feed. Pinned channels (onboarding picks) lead.
  const channels = $derived(
    partitionPinnedChannels(
      deriveChannels(Object.values(timelineStore.postsById)),
      preferencesStore.pinnedChannels
    )
  );
</script>

<div class="chips">
  {#each [...channels.pinned, ...channels.rest] as channel (channel.name)}
    {@const pinned = preferencesStore.pinnedChannels.includes(channel.name)}
    <button
      class="chip"
      class:included={filterStore.channelStates[channel.name] === "included"}
      class:excluded={filterStore.channelStates[channel.name] === "excluded"}
      onclick={() => filterStore.tapChannelChip(channel.name)}
    >
      {#if pinned}
        <svg class="pin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
        </svg>
      {/if}
      #{channel.name}
      {#if channel.postCount > 0}<span class="count">{channel.postCount}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.5rem 1rem 0.5rem 0.25rem;
    scrollbar-width: none;
    flex: 1;
    min-width: 0;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 500;
  }
  .count {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .pin {
    flex-shrink: 0;
  }
  .chip.included {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .chip.excluded {
    text-decoration: line-through;
    opacity: 0.6;
  }
</style>
