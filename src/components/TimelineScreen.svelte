<script lang="ts">
  import { t } from "@/lib/i18n/index.svelte";
  import { authStore } from "@/stores/auth.svelte";
  import { filterStore } from "@/stores/filters.svelte";
  import { preferencesStore } from "@/stores/preferences.svelte";
  import { timelineController } from "@/stores/timeline-controller.svelte";
  import { buildTimeline, timelineStore } from "@/stores/timeline.svelte";
  import ChannelChips from "./ChannelChips.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import RelaySheet from "./RelaySheet.svelte";
  import Sidebar from "./Sidebar.svelte";
  import SpaceSelector from "./SpaceSelector.svelte";
  import StateRow from "./StateRow.svelte";
  import TimelineCard from "./TimelineCard.svelte";
  import UnifiedBar from "./UnifiedBar.svelte";

  const items = $derived(
    buildTimeline(timelineStore.postsById, {
      channelStates: timelineController.effectiveChannelStates,
      activeRelayId: filterStore.activeRelayId,
      searchQuery: timelineController.searchText,
      pinnedChannels: preferencesStore.pinnedChannelNamesFor(timelineController.scopeRelayIds),
      myPubkey: authStore.session?.pubkeyHex ?? null,
      focusedPostId: filterStore.focusedPostId,
    })
  );

  // Recycler-style windowing: only the newest WINDOW_STEP-sized tail renders;
  // scrolling to the top reveals older items incrementally instead of
  // mounting thousands of cards at once.
  const WINDOW_STEP = 80;
  let visibleCount = $state(WINDOW_STEP);
  const windowed = $derived(items.slice(Math.max(0, items.length - visibleCount)));

  const focusedPost = $derived(
    filterStore.focusedPostId ? timelineStore.postsById[filterStore.focusedPostId] : null
  );

  let relaySheetPostId = $state<string | null>(null);
  let menuOpen = $state(false);

  let feedElement = $state<HTMLElement | null>(null);
  // User intent: pinned means "keep me at the newest message". Starts true so
  // hydration lands at the bottom; any upward scroll releases it.
  let pinnedToBottom = true;
  let lastItemCount = 0;

  function scrollToBottom() {
    const element = feedElement;
    if (element) element.scrollTop = element.scrollHeight;
  }

  function onFeedScroll() {
    const element = feedElement;
    if (!element) return;
    pinnedToBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (element.scrollTop < 300 && visibleCount < items.length) revealOlder();
  }

  // Revealing older items prepends content — keep the viewport anchored on
  // the message the user was reading.
  function revealOlder() {
    const element = feedElement;
    if (!element) return;
    const previousHeight = element.scrollHeight;
    const previousTop = element.scrollTop;
    visibleCount += WINDOW_STEP;
    requestAnimationFrame(() => {
      element.scrollTop = previousTop + (element.scrollHeight - previousHeight);
    });
  }

  // why: with a tail window, every ingested batch would shift the window
  // while reading history — grow the window BEFORE the DOM updates (pre) so
  // the visible slice keeps covering the same messages with no transient
  // slid frame.
  $effect.pre(() => {
    const count = items.length;
    const grewBy = count - lastItemCount;
    lastItemCount = count;
    if (grewBy > 0 && !pinnedToBottom) visibleCount += grewBy;
  });

  // why: when pinned, every rendered items change must land at the bottom —
  // runs after the DOM update so scrollHeight includes the new content.
  $effect(() => {
    void windowed.length;
    if (pinnedToBottom) scrollToBottom();
  });

  // why: layout changes (viewport resize, images loading, keyboard opening)
  // change scrollHeight without an items change — a pinned view must follow.
  $effect(() => {
    const element = feedElement;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (pinnedToBottom) scrollToBottom();
    });
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  });
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
      <SpaceSelector />
      <ChannelChips />
    </header>

    {#if focusedPost}
      <div class="thread-bar">
        <span class="thread-title">{t("timeline.thread")} · {focusedPost.content.split("\n")[0]}</span>
        <button class="thread-close" onclick={() => filterStore.clearThread()} data-testid="thread-close">
          ✕
        </button>
      </div>
    {/if}

    <main class="feed" bind:this={feedElement} onscroll={onFeedScroll}>
      <div class="feed-content">
        {#if timelineStore.hydrating && items.length === 0}
          <p class="empty">{t("timeline.loading")}</p>
        {:else if items.length === 0}
          <p class="empty">{t("timeline.empty")}</p>
        {:else}
          {#if visibleCount < items.length}
            <button class="older" onclick={revealOlder}>{t("timeline.older")}</button>
          {/if}
          {#each windowed as item (item.type === "post" ? item.post.id : item.update.id)}
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
      </div>
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
  }
  .rail {
    display: none;
  }
  /* Full-bleed column at every width — no max-width caps, no side gutters. */
  .column {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
  }
  /* Desktop: persistent sidebar replaces the hamburger + chips row. */
  @media (min-width: 900px) {
    .screen {
      display: grid;
      grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr);
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
  }
  .older {
    display: block;
    width: 100%;
    padding: 0.6rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    text-align: center;
  }
  .older:hover {
    color: var(--accent);
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 3rem 2rem;
    font-size: 0.95rem;
  }
</style>
