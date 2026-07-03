<script lang="ts">
  import {
    deriveChannels,
    partitionPinnedChannels,
    topicTags,
    type Channel,
    type Topic,
  } from "@/domain/channel";
  import { longpress } from "@/lib/longpress";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import TopicManager from "./TopicManager.svelte";

  // Channels come from ALL posts (unfiltered) so chips don't vanish while
  // filtering narrows the feed. Pinned topics are always visible up front;
  // other topics unfold after ANY of their channels once it is selected
  // (sketch rows A→B) — each topic appears at most once.
  type ChipItem =
    | { kind: "channel"; channel: Channel; pinned: boolean }
    | { kind: "topic"; topic: Topic };

  const chipItems = $derived.by(() => {
    const channels = partitionPinnedChannels(
      deriveChannels(Object.values(timelineStore.postsById)),
      preferencesStore.pinnedChannels
    );
    const items: ChipItem[] = [];
    const shownTopics = new Set<string>();
    for (const topic of timelineStore.topics) {
      if (preferencesStore.isTopicPinned(topic.id)) {
        items.push({ kind: "topic", topic });
        shownTopics.add(topic.id);
      }
    }
    const pushChannel = (channel: Channel, pinned: boolean) => {
      items.push({ kind: "channel", channel, pinned });
      if (filterStore.channelStates[channel.name] !== "included") return;
      for (const topic of timelineStore.topics) {
        if (shownTopics.has(topic.id)) continue;
        if (topicTags(topic).includes(channel.name)) {
          items.push({ kind: "topic", topic });
          shownTopics.add(topic.id);
        }
      }
    };
    for (const channel of channels.pinned) pushChannel(channel, true);
    for (const channel of channels.rest) pushChannel(channel, false);
    return items;
  });

  let manager = $state<{ type: "create" } | { type: "manage"; topic: Topic } | null>(null);
</script>

<div class="chips">
  {#each chipItems as item (item.kind === "topic" ? `t:${item.topic.id}` : `c:${item.channel.name}`)}
    {#if item.kind === "topic"}
      {@const topic = item.topic}
      <button
        class="chip topic"
        class:included={filterStore.selectedTopicIds.includes(topic.id)}
        onclick={() => filterStore.toggleTopic(topic)}
        use:longpress={() => (manager = { type: "manage", topic })}
      >
        {#if preferencesStore.isTopicPinned(topic.id)}
          <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
          </svg>
        {:else}
          <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 8l8-4 8 4-8 4z M4 14l8 4 8-4" />
          </svg>
        {/if}
        {topic.name}
      </button>
    {:else}
      {@const channel = item.channel}
      <button
        class="chip"
        class:included={filterStore.channelStates[channel.name] === "included"}
        class:excluded={filterStore.channelStates[channel.name] === "excluded"}
        onclick={() => filterStore.tapChannelChip(channel.name)}
        use:longpress={() => preferencesStore.togglePinned(channel.name)}
      >
        {#if item.pinned}
          <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 17v5M7 4h10l-1.5 6.5 2.5 3.5H6l2.5-3.5z" />
          </svg>
        {/if}
        #{channel.name}
        {#if channel.postCount > 0}<span class="count">{channel.postCount}</span>{/if}
      </button>
    {/if}
  {/each}
  <button class="chip add" onclick={() => (manager = { type: "create" })} data-testid="new-topic">
    +
  </button>
</div>

{#if manager}
  <TopicManager mode={manager} onClose={() => (manager = null)} />
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
