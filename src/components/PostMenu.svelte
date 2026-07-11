<script lang="ts">
  import type { Post } from "@/domain/post";
  import { buildPostPermalink } from "@/domain/permalink";
  import { filterStore } from "@/stores/filters.svelte";
  import { timelineStore } from "@/stores/timeline.svelte";
  import { t } from "@/lib/i18n/index.svelte";

  // Compact context menu for one post: a small bottom sheet on phones, a
  // centered card on desktop. Actions the caller wires up stay thin here —
  // reply focuses the thread, copy-link builds the permalink and confirms.
  let { post, onClose }: { post: Post; onClose: () => void } = $props();

  let copied = $state(false);
  let error = $state("");

  function reply() {
    filterStore.focusThread(post.id);
    onClose();
  }

  async function copyLink() {
    error = "";
    const url = buildPostPermalink(
      location.origin,
      post.id,
      post.relays,
      timelineStore.relays,
      filterStore.activeRelayId
    );
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(onClose, 900);
    } catch {
      error = t("postmenu.copyFailed");
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}></div>
<div class="menu" data-testid="post-menu">
  <div class="grip"></div>
  <button class="item" onclick={reply}>
    <span class="glyph">↩</span>{t("postmenu.reply")}
  </button>
  <button class="item" onclick={copyLink} data-testid="post-menu-copy">
    <span class="glyph">🔗</span>{copied ? t("postmenu.copied") : t("postmenu.copyLink")}
  </button>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.4);
    z-index: 60;
  }
  .menu {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 24rem;
    margin-inline: auto;
    z-index: 61;
    background: var(--surface);
    border-radius: 1rem 1rem 0 0;
    padding: 0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.25);
    animation: slide-up 180ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  /* Desktop: a small centered card rather than a docked sheet. */
  @media (min-width: 900px) {
    .menu {
      top: 50%;
      bottom: auto;
      transform: translateY(-50%);
      border-radius: 1rem;
      padding: 0.75rem;
      animation: fade-in 140ms ease-out;
    }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .grip {
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: var(--border);
    margin: 0.25rem auto 0.35rem;
  }
  @media (min-width: 900px) {
    .grip {
      display: none;
    }
  }
  .item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    padding: 0.7rem 0.6rem;
    border-radius: 0.6rem;
    font-size: 0.95rem;
    text-align: left;
    color: var(--text);
  }
  .item:hover {
    background: var(--accent-muted);
  }
  .glyph {
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }
  .error {
    margin: 0.1rem 0.6rem 0;
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
