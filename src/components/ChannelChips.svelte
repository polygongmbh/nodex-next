<script lang="ts">
  import { deriveChannels, partitionPinnedChannels, type Topic } from "@/domain/channel";
  import { longpress } from "@/lib/longpress";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import TopicManager from "./TopicManager.svelte";

  // Channels come from ALL posts (unfiltered) so chips don't vanish while
  // filtering narrows the feed. Order: pinned topics, pinned channels,
  // remaining topics, remaining channels, then the "+" (new topic) chip.
  const channels = $derived(
    partitionPinnedChannels(
      deriveChannels(Object.values(timelineStore.postsById)),
      preferencesStore.pinnedChannels
    )
  );
  const topics = $derived({
    pinned: preferencesStore.topics.filter((topic) => topic.pinned),
    rest: preferencesStore.topics.filter((topic) => !topic.pinned),
  });

  const contextTags = $derived(
    Object.entries(timelineController.effectiveChannelStates)
      .filter(([, state]) => state === "included")
      .map(([name]) => name)
  );

  let manager = $state<{ type: "create" } | { type: "manage"; topic: Topic } | null>(null);
</script>

{#snippet topicChip(topic: Topic)}
  <button
    class="chip topic"
    class:included={filterStore.selectedTopicIds.includes(topic.id)}
    onclick={() => filterStore.toggleTopic(topic.id)}
    use:longpress={() => (manager = { type: "manage", topic })}
  >
    <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8l8-4 8 4-8 4z M4 14l8 4 8-4" />
    </svg>
    {topic.name}
  </button>
{/snippet}

{#snippet channelChip(name: string, postCount: number, pinned: boolean)}
  <button
    class="chip"
    class:included={filterStore.channelStates[name] === "included"}
    class:excluded={filterStore.channelStates[name] === "excluded"}
    onclick={() => filterStore.tapChannelChip(name)}
    use:longpress={() => preferencesStore.togglePinned(name)}
  >
    {#if pinned}
      <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
      </svg>
    {/if}
    #{name}
    {#if postCount > 0}<span class="count">{postCount}</span>{/if}
  </button>
{/snippet}

<div class="chips">
  {#each topics.pinned as topic (topic.id)}
    {@render topicChip(topic)}
  {/each}
  {#each channels.pinned as channel (channel.name)}
    {@render channelChip(channel.name, channel.postCount, true)}
  {/each}
  {#each topics.rest as topic (topic.id)}
    {@render topicChip(topic)}
  {/each}
  {#each channels.rest as channel (channel.name)}
    {@render channelChip(channel.name, channel.postCount, false)}
  {/each}
  <button class="chip add" onclick={() => (manager = { type: "create" })} data-testid="new-topic">
    +
  </button>
</div>

{#if manager}
  <TopicManager mode={manager} {contextTags} onClose={() => (manager = null)} />
{/if}

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
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-x;
  }
  .count {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .icon {
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
  .chip.topic {
    border-style: dashed;
  }
  .chip.topic.included {
    border-style: solid;
  }
  .chip.add {
    font-weight: 700;
    padding-inline: 0.65rem;
  }
</style>
