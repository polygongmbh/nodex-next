<script lang="ts">
  import { deriveChannels } from "@/domain/channel";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";

  // Channels come from ALL posts (unfiltered) so chips don't vanish while
  // filtering narrows the feed.
  const channels = $derived(deriveChannels(Object.values(timelineStore.postsById)));
</script>

{#if channels.length > 0}
  <div class="chips">
    {#each channels as channel (channel.name)}
      <button
        class="chip"
        class:included={filterStore.channelStates[channel.name] === "included"}
        class:excluded={filterStore.channelStates[channel.name] === "excluded"}
        onclick={() => filterStore.tapChannelChip(channel.name)}
      >
        #{channel.name}
      </button>
    {/each}
  </div>
{/if}

<style>
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.5rem 1rem;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chip {
    flex-shrink: 0;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 500;
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
