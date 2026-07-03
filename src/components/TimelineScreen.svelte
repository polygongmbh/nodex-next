<script lang="ts">
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { buildTimeline, timelineStore } from "@/stores/timeline.svelte";
  import ChannelChips from "./ChannelChips.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import RelaySheet from "./RelaySheet.svelte";
  import Sidebar from "./Sidebar.svelte";
  import StateRow from "./StateRow.svelte";
  import TimelineCard from "./TimelineCard.svelte";
  import UnifiedBar from "./UnifiedBar.svelte";

  const items = $derived(
    buildTimeline(timelineStore.postsById, {
      channelStates: timelineController.effectiveChannelStates,
      activeRelayId: filterStore.activeRelayId,
      searchQuery: timelineController.searchText,
      pinnedChannels: preferencesStore.pinnedChannels,
      myPubkey: authStore.session?.pubkeyHex ?? null,
      focusedPostId: filterStore.focusedPostId,
    })
  );

  const focusedPost = $derived(
    filterStore.focusedPostId ? timelineStore.postsById[filterStore.focusedPostId] : null
  );

  let relaySheetPostId = $state<string | null>(null);
  let menuOpen = $state(false);
</script>

<div class="screen">
  <div class="rail">
    <Sidebar />
  </div>

  <div class="column">
    <header class="top">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="menu" onclick={() => (menuOpen = true)} data-testid="menu-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <ChannelChips />
    </header>

    {#if focusedPost}
      <div class="thread-bar">
        <span class="thread-title">Thread · {focusedPost.content.split("\n")[0]}</span>
        <button class="thread-close" onclick={() => filterStore.clearThread()} data-testid="thread-close">
          ✕
        </button>
      </div>
    {/if}

    <main class="feed">
      {#if timelineStore.hydrating && items.length === 0}
        <p class="empty">Loading your timeline…</p>
      {:else if items.length === 0}
        <p class="empty">Nothing here yet. Pick different channels or start the conversation.</p>
      {:else}
        {#each items as item (item.type === "post" ? item.post.id : item.update.id)}
          {#if item.type === "post"}
            <TimelineCard
              post={item.post}
              parent={item.parent}
              replyCount={item.replyCount}
              onRelayDots={(postId) => (relaySheetPostId = postId)}
            />
          {:else}
            <StateRow post={item.post} update={item.update} />
          {/if}
        {/each}
      {/if}
    </main>

    <UnifiedBar />
  </div>

  {#if relaySheetPostId}
    <RelaySheet postId={relaySheetPostId} onClose={() => (relaySheetPostId = null)} />
  {/if}
  {#if menuOpen}
    <MenuSheet onClose={() => (menuOpen = false)} />
  {/if}
</div>

<style>
  .screen {
    height: 100dvh;
    max-width: 42rem;
    margin: 0 auto;
  }
  .rail {
    display: none;
  }
  .column {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  /* Desktop: persistent sidebar replaces the hamburger + chips row. */
  @media (min-width: 900px) {
    .screen {
      display: grid;
      grid-template-columns: 16rem minmax(0, 1fr);
      max-width: 68rem;
    }
    .rail {
      display: block;
    }
    .top {
      display: none;
    }
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0 0 0.6rem;
    padding-top: max(0.35rem, env(safe-area-inset-top));
  }
  .menu {
    padding: 0.5rem;
    border-radius: 0.6rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    flex-shrink: 0;
  }
  .thread-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .thread-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thread-close {
    color: var(--text-muted);
    padding: 0.2rem 0.45rem;
    flex-shrink: 0;
  }
  .thread-close:hover {
    color: var(--text);
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
