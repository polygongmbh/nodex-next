<script lang="ts">
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore, visibleTimeline } from "@/stores/timeline.svelte";
  import ChannelChips from "./ChannelChips.svelte";
  import Composer from "./Composer.svelte";
  import RelaySheet from "./RelaySheet.svelte";
  import SpaceSelector from "./SpaceSelector.svelte";
  import TimelineCard from "./TimelineCard.svelte";

  const entries = $derived(
    visibleTimeline(
      timelineStore.postsById,
      filterStore.channelStates,
      filterStore.activeRelayId
    )
  );

  let relaySheetPostId = $state<string | null>(null);
</script>

<div class="screen">
  <header class="top">
    <SpaceSelector />
    <button class="signout" onclick={() => authStore.signOut()} data-testid="sign-out">
      {authStore.session?.username}
    </button>
  </header>
  <ChannelChips />

  <main class="feed">
    {#if timelineStore.hydrating && entries.length === 0}
      <p class="empty">Loading your timeline…</p>
    {:else if entries.length === 0}
      <p class="empty">Nothing here yet. Pick different channels or start the conversation.</p>
    {:else}
      {#each entries as entry (entry.post.id)}
        <TimelineCard {entry} onRelayDots={(postId) => (relaySheetPostId = postId)} />
      {/each}
    {/if}
  </main>

  <Composer />

  {#if relaySheetPostId}
    <RelaySheet postId={relaySheetPostId} onClose={() => (relaySheetPostId = null)} />
  {/if}
</div>

<style>
  .screen {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 42rem;
    margin: 0 auto;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 1rem 0.1rem;
    padding-top: max(0.6rem, env(safe-area-inset-top));
  }
  .signout {
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 0.35rem 0.5rem;
  }
  .feed {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--surface-sunken);
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 3rem 2rem;
    font-size: 0.95rem;
  }
</style>
